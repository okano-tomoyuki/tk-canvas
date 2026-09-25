/**
 * 生成した Python（tkinter）のコードを実際に実行して検証する（docs/adr/0010）。
 *
 *   node tools/codegen/verify-python.mts
 *
 * 1. レイアウトの検証データ（packages/core/src/layout/fixtures/*.tkui.json）から Python のコードを生成して実行し、
 *    各ウィジェットの位置と大きさが Tk で記録した結果（*.tk.json）と一致することを確かめる。
 * 2. コード生成のテスト用ドキュメント（packages/codegen/src/testing.ts）を実行し、
 *    変数・command・bind が正しく結び付いていること（ハンドラが呼ばれること）を確かめる。
 * 3. Frame をルートにした部品を別のウィンドウに埋め込み、ルートのオプション・子の配置・bind を確かめる。
 *
 * tkinter の使える Python が PATH にあること（環境変数 PYTHON で上書きできる）。
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument, type TkuiDocument } from '../../packages/core/src/index.ts';
import { generatePython } from '../../packages/codegen/src/index.ts';
import { SAMPLE } from '../../packages/codegen/src/testing.ts';

const python = process.env.PYTHON ?? 'python';
const fixturesDir = fileURLToPath(
  new URL('../../packages/core/src/layout/fixtures/', import.meta.url),
);
const workDir = mkdtempSync(join(tmpdir(), 'tkd-verify-python-'));
let failures = 0;

try {
  verifyLayouts();
  verifyEvents();
  verifyFrameRoot();
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

if (failures > 0) {
  console.error(`\n${String(failures)} 件の不一致があります`);
  process.exitCode = 1;
} else {
  console.log('\nすべて一致しました');
}

// ---- 1. 配置の検証 -------------------------------------------------------------

interface TkRecord {
  readonly widgets: Readonly<
    Record<string, { readonly rect: readonly number[]; readonly mapped: boolean }>
  >;
}

function verifyLayouts(): void {
  for (const file of readdirSync(fixturesDir).filter((f) => f.endsWith('.tkui.json'))) {
    const name = file.replace(/\.tkui\.json$/, '');
    const doc = load(readFileSync(join(fixturesDir, file), 'utf8'), file);
    const expected = JSON.parse(
      readFileSync(join(fixturesDir, `${name}.tk.json`), 'utf8'),
    ) as TkRecord;
    const module = writeModule(name.replace(/-/g, '_'), { ...doc, codegen: { python: {} } }, file);

    // ウィジェットごとに、ルートウィンドウの内側の左上からの位置と大きさを出力する
    const ids = Object.keys(expected.widgets);
    const actual = runPython(`
import json, ${module}
ui = ${module}.${className(module)}()
root = ui
root.update()
root.update_idletasks()
root.update()
result = {}
for wid in ${JSON.stringify(ids)}:
    w = ui if wid == ${JSON.stringify(doc.root.id)} else getattr(ui, wid)
    result[wid] = {
        "rect": [w.winfo_rootx() - root.winfo_rootx(), w.winfo_rooty() - root.winfo_rooty(), w.winfo_width(), w.winfo_height()],
        "mapped": bool(w.winfo_ismapped()),
    }
print(json.dumps(result))
root.destroy()
`) as Record<string, { rect: number[]; mapped: boolean }>;

    let ok = true;
    for (const id of ids) {
      const e = expected.widgets[id];
      const a = actual[id];
      if (
        !e ||
        !a ||
        e.mapped !== a.mapped ||
        (e.mapped && e.rect.join(',') !== a.rect.join(','))
      ) {
        ok = false;
        console.error(`  ✗ ${name}.${id}: 期待 ${JSON.stringify(e)} / 実際 ${JSON.stringify(a)}`);
      }
    }
    if (ok) console.log(`✓ 配置: ${name}（${String(ids.length)} ウィジェット）`);
    else failures++;
  }
}

// ---- 2. 変数・イベントの検証 -----------------------------------------------------

function verifyEvents(): void {
  const module = writeModule('main_window', SAMPLE, 'main_window.tkui.json');
  // 生成された雛形のハンドラを、呼ばれたことを記録するものに差し替えてから操作する
  const calls = runPython(`
import json, ${module}
calls = []
cls = ${module}.MainWindow
cls.on_submit = lambda self: calls.append("on_submit")
cls.on_level = lambda self, value: calls.append("on_level")
cls.on_name_return = lambda self, event: calls.append("on_name_return")
ui = cls()
root = ui
root.update()
ui.submit_button.invoke()
ui.level_scale.set(3)
ui.name_entry.focus_force()
root.update()
ui.name_entry.event_generate("<Return>")
root.update()
ui.mode_b.invoke()
calls.append("mode=" + str(ui.mode.get()))
calls.append("title=" + root.title())
print(json.dumps(calls))
root.destroy()
`) as string[];

  const expected = ['on_submit', 'on_level', 'on_name_return', 'mode=2', 'title=Sample'];
  const missing = expected.filter((c) => !calls.includes(c));
  if (missing.length === 0) {
    console.log(`✓ 変数・イベント: ${calls.join(', ')}`);
  } else {
    failures++;
    console.error(`  ✗ 変数・イベント: 期待 ${expected.join(', ')} / 実際 ${calls.join(', ')}`);
  }
}

// ---- 3. Frame をルートにした部品の検証 --------------------------------------------

function verifyFrameRoot(): void {
  const doc: TkuiDocument = {
    ...SAMPLE,
    root: {
      ...SAMPLE.root,
      class: 'ttk.Labelframe',
      window: undefined,
      options: { text: 'Settings', padding: 8 },
      bindings: [{ sequence: '<<Probe>>', handler: 'on_probe' }],
    },
  };
  const module = writeModule('settings_panel', doc, 'settings_panel.tkui.json');
  const result = runPython(`
import json, tkinter as tk, ${module}
calls = []
cls = ${module}.SettingsPanel
cls.on_probe = lambda self, event: calls.append("on_probe")
root = tk.Tk()
panel = cls(root, name="panel")
panel.pack(fill="both", expand=True)
root.update()
panel.event_generate("<<Probe>>")
root.update()
calls.append("class=" + panel.winfo_class())
calls.append("text=" + str(panel.cget("text")))
calls.append("path=" + str(panel))
calls.append("child_parent=" + str(panel.name_label.master is panel))
calls.append("mapped=" + str(bool(panel.tabs.winfo_ismapped())))
print(json.dumps(calls))
root.destroy()
`) as string[];

  const expected = [
    'on_probe',
    'class=TLabelframe',
    'text=Settings',
    'path=.panel',
    'child_parent=True',
    'mapped=True',
  ];
  const missing = expected.filter((c) => !result.includes(c));
  if (missing.length === 0) {
    console.log(`✓ Frame のルート: ${result.join(', ')}`);
  } else {
    failures++;
    console.error(`  ✗ Frame のルート: 期待 ${expected.join(', ')} / 実際 ${result.join(', ')}`);
  }
}

// ---- 補助 ---------------------------------------------------------------------

function load(text: string, file: string): TkuiDocument {
  const { document, diagnostics } = parseDocument(text);
  if (!document || diagnostics.length > 0) throw new Error(`${file} が検証を通りません`);
  return document;
}

/** コードを生成して作業フォルダに書き出し、モジュール名を返す */
function writeModule(module: string, doc: TkuiDocument, dslFileName: string): string {
  const result = generatePython(doc, `${module}.tkui.json`, undefined);
  if (!result.ok) throw new Error(`${dslFileName}: ${result.error}`);
  writeFileSync(join(workDir, `${module}.py`), result.text);
  return module;
}

function className(module: string): string {
  return module
    .split('_')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

function runPython(script: string): unknown {
  const output = execFileSync(python, ['-c', script], { cwd: workDir, encoding: 'utf8' });
  const lastLine = output.trim().split(/\r?\n/).pop() ?? '';
  return JSON.parse(lastLine);
}
