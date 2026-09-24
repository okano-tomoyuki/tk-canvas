/**
 * レイアウトエンジンの検証データを実際の Tk で記録する（docs/adr/0008「検証方法」）。
 *
 *   node tools/layout/record.mts
 *
 * packages/core/src/layout/fixtures/*.tkui.json を Tcl スクリプトに変換して tclsh で表示し、
 * 各ウィジェットの要求サイズ（winfo reqwidth/reqheight）と実際の配置を *.tk.json に書き出す。
 * Tk 入りの tclsh が PATH にあること（環境変数 TCLSH で上書きできる）。
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  containerKindOf,
  getWidgetCatalog,
  parseDocument,
  type AnyNode,
  type LiteralValue,
  type OptionValue,
  type TkuiDocument,
} from '../../packages/core/src/index.ts';

const fixturesDir = fileURLToPath(
  new URL('../../packages/core/src/layout/fixtures/', import.meta.url),
);
const tclsh = process.env.TCLSH ?? 'tclsh';

for (const file of readdirSync(fixturesDir).filter((f) => f.endsWith('.tkui.json'))) {
  const { document, diagnostics } = parseDocument(readFileSync(join(fixturesDir, file), 'utf8'));
  if (!document || diagnostics.length > 0) {
    throw new Error(
      `${file}: ${diagnostics.map((d) => `${d.path.join('.')}: ${d.message}`).join('\n')}`,
    );
  }
  const scriptFile = join(tmpdir(), `tkd-layout-${String(process.pid)}.tcl`);
  writeFileSync(scriptFile, toTcl(document));
  const output = execFileSync(tclsh, [scriptFile], { encoding: 'utf8' });
  const outFile = join(fixturesDir, file.replace(/\.tkui\.json$/, '.tk.json'));
  writeFileSync(outFile, `${JSON.stringify(parseRecords(output), null, 2)}\n`);
  console.log(`記録しました: ${outFile}`);
}

/**
 * Tcl の出力（1行目: バージョン情報、2行目以降: ウィジェットごとの記録）を JSON に変換する。
 *   tk <patchlevel> <windowingsystem>
 *   <id> <reqwidth> <reqheight> <x> <y> <width> <height> <ismapped>
 */
function parseRecords(output: string) {
  const [header = '', ...rows] = output.trim().split(/\r?\n/);
  const [, tkVersion, windowingSystem] = header.split(' ');
  const widgets: Record<string, unknown> = {};
  for (const row of rows) {
    const [id = '', ...numbers] = row.split(' ');
    const [rw, rh, x, y, w, h, mapped] = numbers.map(Number);
    widgets[id] = { requested: [rw, rh], rect: [x, y, w, h], mapped: mapped === 1 };
  }
  return { tkVersion, windowingSystem, widgets };
}

// ---- DSL → Tcl ----------------------------------------------------------------

function toTcl(doc: TkuiDocument): string {
  const lines = ['package require Tk'];
  const paths = new Map<AnyNode, string>();
  const nodes: AnyNode[] = [];
  const visit = (node: AnyNode, path: string) => {
    paths.set(node, path);
    nodes.push(node);
    for (const child of node.children ?? [])
      visit(child, path === '.' ? `.${child.id}` : `${path}.${child.id}`);
  };
  visit(doc.root, '.');

  const geometry = doc.root.window?.geometry;
  if (geometry) lines.push(`wm geometry . ${geometry}+0+0`);

  // 1. 生成（親から順に）
  for (const node of nodes) {
    const path = paths.get(node) ?? '.';
    const options = literalOptions(node);
    if (node === doc.root) {
      if (options) lines.push(`. configure ${options}`);
    } else {
      const command = getWidgetCatalog().classes.get(node.class)?.tclCommand ?? node.class;
      lines.push(`${command} ${path} ${options}`);
    }
  }

  // 2. 配置（children の順が pack の順になる）
  for (const node of nodes) {
    const path = paths.get(node) ?? '.';
    const layout = node.layout;
    if (layout?.manager === 'grid') {
      for (const [axis, entries] of [
        ['column', layout.columns],
        ['row', layout.rows],
      ] as const) {
        for (const [index, config] of Object.entries(entries ?? {})) {
          lines.push(`grid ${axis}configure ${path} ${index} ${flags(config)}`);
        }
      }
    }
    if (layout && 'propagate' in layout && layout.propagate === false) {
      lines.push(`${layout.manager} propagate ${path} 0`);
    }
    const kind = containerKindOf(node);
    for (const child of node.children ?? []) {
      const childPath = paths.get(child) ?? '';
      const args = flags(child.placement ?? {});
      if (kind === 'notebook' || kind === 'paned') lines.push(`${path} add ${childPath} ${args}`);
      else lines.push(`${kind ?? 'pack'} ${childPath} ${args}`);
    }
  }

  // 3. 記録（形式は parseRecords を参照）。位置はルートウィンドウの内側の左上からの相対位置
  lines.push(
    'update',
    'update idletasks',
    'update',
    'proc record {id w} {',
    '  set x [expr {[winfo rootx $w] - [winfo rootx .]}]',
    '  set y [expr {[winfo rooty $w] - [winfo rooty .]}]',
    '  puts [list $id [winfo reqwidth $w] [winfo reqheight $w] $x $y [winfo width $w] [winfo height $w] [winfo ismapped $w]]',
    '}',
    'puts [list tk [info patchlevel] [tk windowingsystem]]',
  );
  for (const node of nodes) lines.push(`record ${node.id} ${paths.get(node) ?? '.'}`);
  lines.push('exit');
  return `${lines.join('\n')}\n`;
}

function literalOptions(node: AnyNode): string {
  return Object.entries(node.options ?? {})
    .filter((entry): entry is [string, LiteralValue] => isLiteral(entry[1]))
    .map(([name, value]) => `-${name} ${tclWord(value)}`)
    .join(' ');
}

function isLiteral(value: OptionValue): value is LiteralValue {
  return typeof value !== 'object' || Array.isArray(value);
}

function flags(record: object): string {
  return Object.entries(record)
    .map(([name, value]) => `-${name} ${tclWord(value as LiteralValue)}`)
    .join(' ');
}

function tclWord(value: LiteralValue): string {
  if (Array.isArray(value)) return `{${(value as readonly LiteralValue[]).map(tclWord).join(' ')}}`;
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number') return String(value);
  const text = String(value);
  if (/^[\w.:#+-]+$/.test(text)) return text;
  // 波括弧・バックスラッシュを含まなければ {...} で囲めばそのまま渡せる
  if (!/[{}\\]/.test(text)) return `{${text}}`;
  return text.replace(/([\\{}[\]$"\s;])/g, '\\$1');
}
