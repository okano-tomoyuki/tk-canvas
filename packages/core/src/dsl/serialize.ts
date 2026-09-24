/**
 * ドキュメントを正規形のテキストに変換する（docs/dsl-spec.md「正規形」）。
 * 同じ内容なら常に同じテキストになるようにし、1操作による差分を最小にする（docs/adr/0006）。
 */
import type { TkuiDocument } from './schema.ts';

/** オブジェクトの種類ごとのキー順。ここにないキーは末尾に辞書順で並べる */
const KEY_ORDER: readonly string[] = [
  // ドキュメント
  '$schema',
  'formatVersion',
  'codegen',
  'variables',
  'root',
  // codegen
  'python',
  'cpp',
  'className',
  'file',
  'header',
  'source',
  // ノード
  'id',
  'class',
  'window',
  'options',
  'layout',
  'placement',
  'bindings',
  'children',
  // window
  'title',
  'geometry',
  'resizable',
  'minsize',
  'maxsize',
  // layout
  'manager',
  'propagate',
  'columns',
  'rows',
  // placement（pack / grid / place / タブ / ペイン）
  'side',
  'fill',
  'expand',
  'row',
  'column',
  'rowspan',
  'columnspan',
  'sticky',
  'x',
  'y',
  'relx',
  'rely',
  'width',
  'height',
  'relwidth',
  'relheight',
  'anchor',
  'bordermode',
  'padx',
  'pady',
  'ipadx',
  'ipady',
  'text',
  'underline',
  'padding',
  'state',
  // 変数・グリッド線・バインディング
  'type',
  'value',
  'weight',
  'pad',
  'uniform',
  'sequence',
  'handler',
];

/** キー自体が利用者の決めた名前であるオブジェクト。キーを辞書順（数字は数値順）に並べる */
const NAME_KEYED_OBJECTS: ReadonlySet<string> = new Set([
  'variables',
  'options',
  'columns',
  'rows',
]);

const INDENT = '  ';

export function serializeDocument(doc: TkuiDocument): string {
  return `${stringify(doc, '', undefined)}\n`;
}

function stringify(value: unknown, indent: string, parentKey: string | undefined): string {
  if (Array.isArray(value)) {
    const items: readonly unknown[] = value;
    if (items.length === 0) return '[]';
    // プリミティブだけの短い配列（resizable, padx, font 等）は1行で書く
    if (items.every(isPrimitive)) return `[${items.map((v) => JSON.stringify(v)).join(', ')}]`;
    const inner = indent + INDENT;
    return `[\n${items.map((v) => inner + stringify(v, inner, undefined)).join(',\n')}\n${indent}]`;
  }
  if (typeof value === 'object' && value !== null) {
    const entries = sortEntries(
      Object.entries(value).filter(([, v]) => v !== undefined),
      parentKey !== undefined && NAME_KEYED_OBJECTS.has(parentKey),
    );
    if (entries.length === 0) return '{}';
    const inner = indent + INDENT;
    const body = entries
      .map(([k, v]) => `${inner}${JSON.stringify(k)}: ${stringify(v, inner, k)}`)
      .join(',\n');
    return `{\n${body}\n${indent}}`;
  }
  return JSON.stringify(value);
}

function sortEntries(entries: [string, unknown][], byName: boolean): [string, unknown][] {
  if (byName) {
    return entries.sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }));
  }
  const rank = (key: string) => {
    const i = KEY_ORDER.indexOf(key);
    return i === -1 ? KEY_ORDER.length : i;
  };
  return entries.sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b, 'en'));
}

function isPrimitive(value: unknown): boolean {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}
