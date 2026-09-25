/**
 * 生成した C++（cpp_tk）のコードを実際にビルド・実行して検証する（docs/adr/0010）。
 *
 *   node tools/codegen/verify-cpp.mts
 *
 * 1. レイアウトの検証データ（packages/core/src/layout/fixtures/*.tkui.json）からコードを生成してビルド・実行し、
 *    各ウィジェットの位置と大きさが Tk で記録した結果（*.tk.json）と一致することを確かめる。
 * 2. コード生成のテスト用ドキュメント（packages/codegen/src/testing.ts）をビルド・実行し、
 *    変数・command・bind が正しく結び付いていること（ハンドラが呼ばれること）を確かめる。
 * 3. ルートが Toplevel の画面を、ウィンドウの設定を含めて確かめる。
 * 4. Frame をルートにした部品を別のウィンドウに埋め込み、ルートのオプション・bind と、
 *    別スレッドからの post()（生成したクラスが Widget を継承していることの確認）を確かめる。
 *
 * 必要なもの: C++ コンパイラ・CMake・Ninja・Tcl/Tk（Windows では MSYS2 の mingw64 環境）と、cpp_tk のソース。
 * cpp_tk の場所は環境変数 CPP_TK_DIR で指定する（既定: このリポジトリと同じ階層の cpp_tk）。
 * ビルドの作業フォルダは .cache/verify-cpp（2回目以降は差分ビルドになる）。
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument, walkNodes, type TkuiDocument } from '../../packages/core/src/index.ts';
import { generateCpp, toClassName } from '../../packages/codegen/src/index.ts';
import { SAMPLE } from '../../packages/codegen/src/testing.ts';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const fixturesDir = join(repoRoot, 'packages/core/src/layout/fixtures');
const cppTkDir = resolve(process.env.CPP_TK_DIR ?? join(repoRoot, '../cpp_tk'));
const workDir = join(repoRoot, '.cache/verify-cpp');
const buildDir = join(workDir, 'build');
let failures = 0;

/** 生成したクラスのメンバ（private）を検証のために参照する */
const EXPOSE_MEMBERS = '#define private public\n';

const EVENTS_HARNESS = `${EXPOSE_MEMBERS}#include "main_window.hpp"
#undef private
#include <iostream>
#include <string>
#include <vector>

std::vector<std::string> tkd_calls;

int main()
{
    MainWindow ui;
    ui.update();
    ui.submit_button.invoke();
    // ttk::Scale には set がないため、Tcl の "set" を直接呼ぶ（Python の ttk.Scale.set と同じ）
    ui.level_scale.call({ui.level_scale.full_name(), "set", "3"});
    ui.name_entry.focus_force();
    ui.update();
    ui.name_entry.event_generate("<Return>");
    ui.update();
    ui.mode_b.invoke();
    tkd_calls.push_back("mode=" + std::to_string(ui.mode.get()));
    tkd_calls.push_back("title=" + ui.call({"wm", "title", "."}));
    std::cout << "[";
    for (size_t i = 0; i < tkd_calls.size(); ++i) std::cout << (i ? "," : "") << "\\"" << tkd_calls[i] << "\\"";
    std::cout << "]" << std::endl;
    return 0;
}
`;

interface TkRecord {
  readonly widgets: Readonly<
    Record<string, { readonly rect: readonly number[]; readonly mapped: boolean }>
  >;
}

// ---- コードの生成 --------------------------------------------------------------

mkdirSync(workDir, { recursive: true });
const layoutTargets: { module: string; expected: TkRecord }[] = [];

for (const file of readdirSync(fixturesDir).filter((f) => f.endsWith('.tkui.json'))) {
  const name = file.replace(/\.tkui\.json$/, '');
  const module = name.replace(/-/g, '_');
  const doc = load(readFileSync(join(fixturesDir, file), 'utf8'), file);
  const expected = JSON.parse(
    readFileSync(join(fixturesDir, `${name}.tk.json`), 'utf8'),
  ) as TkRecord;
  writeGenerated(module, { ...doc, codegen: { cpp: {} } });
  writeFileSync(
    join(workDir, `${module}_main.cpp`),
    layoutHarness(module, doc, Object.keys(expected.widgets)),
  );
  layoutTargets.push({ module, expected });
}

writeGenerated('main_window', { ...SAMPLE, codegen: { cpp: {} } }, (source) =>
  recordHandlerCalls(source, 'main_window', 'MainWindow'),
);
writeFileSync(join(workDir, 'main_window_main.cpp'), EVENTS_HARNESS);

// ルートが Toplevel の場合（親を受け取る）。ウィンドウの設定をすべて指定する
writeGenerated('dialog', {
  ...SAMPLE,
  codegen: { cpp: {} },
  root: {
    ...SAMPLE.root,
    class: 'tk.Toplevel',
    window: {
      title: 'Dialog',
      geometry: '320x240',
      resizable: [false, false],
      minsize: [100, 80],
      maxsize: [640, 480],
    },
  },
});
writeFileSync(join(workDir, 'dialog_main.cpp'), toplevelHarness());

// ルートが Frame の場合（部品として別のウィンドウに埋め込む）
writeGenerated(
  'settings_panel',
  {
    ...SAMPLE,
    codegen: { cpp: {} },
    root: {
      ...SAMPLE.root,
      class: 'ttk.Labelframe',
      window: undefined,
      options: { text: 'Settings', padding: 8 },
      bindings: [{ sequence: '<<Probe>>', handler: 'on_probe' }],
    },
  },
  (source) => recordHandlerCalls(source, 'settings_panel', 'SettingsPanel'),
);
writeFileSync(join(workDir, 'settings_panel_main.cpp'), frameHarness());

const modules = [...layoutTargets.map((t) => t.module), 'main_window', 'dialog', 'settings_panel'];
writeFileSync(join(workDir, 'CMakeLists.txt'), cmakeLists(modules));

// ---- ビルド ---------------------------------------------------------------------

console.log(`ビルドしています（cpp_tk: ${cppTkDir}）…`);
execFileSync(
  'cmake',
  ['-S', workDir, '-B', buildDir, '-G', 'Ninja', `-DCPP_TK_DIR=${cppTkDir.replace(/\\/g, '/')}`],
  {
    stdio: ['ignore', 'ignore', 'inherit'],
  },
);
execFileSync('cmake', ['--build', buildDir], { stdio: ['ignore', 'ignore', 'inherit'] });

// ---- 1. 配置の検証 -------------------------------------------------------------

for (const { module, expected } of layoutTargets) {
  const actual = run(module) as Record<string, { rect: number[]; mapped: boolean }>;
  let ok = true;
  for (const [id, e] of Object.entries(expected.widgets)) {
    const a = actual[id];
    if (!a || e.mapped !== a.mapped || (e.mapped && e.rect.join(',') !== a.rect.join(','))) {
      ok = false;
      console.error(`  ✗ ${module}.${id}: 期待 ${JSON.stringify(e)} / 実際 ${JSON.stringify(a)}`);
    }
  }
  if (ok)
    console.log(
      `✓ 配置: ${module}（${String(Object.keys(expected.widgets).length)} ウィジェット）`,
    );
  else failures++;
}

// ---- 2. 変数・イベントの検証 -----------------------------------------------------

const calls = run('main_window') as string[];
const expectedCalls = ['on_submit', 'on_level', 'on_name_return', 'mode=2', 'title=Sample'];
const missing = expectedCalls.filter((c) => !calls.includes(c));
if (missing.length === 0) {
  console.log(`✓ 変数・イベント: ${calls.join(', ')}`);
} else {
  failures++;
  console.error(`  ✗ 変数・イベント: 期待 ${expectedCalls.join(', ')} / 実際 ${calls.join(', ')}`);
}

// ---- 3. Toplevel -------------------------------------------------------------

const dialog = run('dialog') as string[];
const expectedDialog = ['title=Dialog', 'size=320x240', 'resizable=0 0'];
if (expectedDialog.every((c) => dialog.includes(c))) {
  console.log(`✓ Toplevel: ${dialog.join(', ')}`);
} else {
  failures++;
  console.error(`  ✗ Toplevel: 期待 ${expectedDialog.join(', ')} / 実際 ${dialog.join(', ')}`);
}

// ---- 4. Frame のルート ----------------------------------------------------------

const panel = run('settings_panel') as string[];
const expectedPanel = [
  'posted',
  'on_probe',
  'class=TLabelframe',
  'text=Settings',
  'parent=.',
  'mapped=1',
];
if (expectedPanel.every((c) => panel.includes(c))) {
  console.log(`✓ Frame のルート: ${panel.join(', ')}`);
} else {
  failures++;
  console.error(`  ✗ Frame のルート: 期待 ${expectedPanel.join(', ')} / 実際 ${panel.join(', ')}`);
}

if (failures > 0) {
  console.error(`\n${String(failures)} 件の不一致があります`);
  process.exitCode = 1;
} else {
  console.log('\nすべて一致しました');
}

// ---- 補助 ---------------------------------------------------------------------

function load(text: string, file: string): TkuiDocument {
  const { document, diagnostics } = parseDocument(text);
  if (!document || diagnostics.length > 0) throw new Error(`${file} が検証を通りません`);
  return document;
}

/** コードを生成して作業フォルダに書き出す（内容が同じなら書き換えず、差分ビルドを効かせる） */
function writeGenerated(
  module: string,
  doc: TkuiDocument,
  editSource: (text: string) => string = (t) => t,
): void {
  const result = generateCpp(doc, `${module}.tkui.json`, undefined, undefined);
  if ('error' in result) throw new Error(result.error);
  if (!result.header.ok || !result.source.ok) throw new Error(`${module}: 生成に失敗しました`);
  writeIfChanged(join(workDir, `${module}.hpp`), result.header.text);
  writeIfChanged(join(workDir, `${module}.cpp`), editSource(result.source.text));
}

function writeIfChanged(path: string, text: string): void {
  let current: string | undefined;
  try {
    current = readFileSync(path, 'utf8');
  } catch {
    current = undefined;
  }
  if (current !== text) writeFileSync(path, text);
}

/** ハンドラの雛形の中身を、呼ばれたことを記録する処理に置き換える */
function recordHandlerCalls(source: string, module: string, className: string): string {
  const include = `#include "${module}.hpp"\n`;
  const withDecl = source.replace(
    include,
    `${include}#include <string>\n#include <vector>\nextern std::vector<std::string> tkd_calls;\n`,
  );
  // className は識別子のため、正規表現の特殊文字を含まない
  return withDecl.replace(
    new RegExp(`void ${className}::(\\w+)\\(([^)]*)\\)\\n\\{\\n {4}// TODO: 実装\\n\\}`, 'g'),
    (_, name: string, params: string) =>
      `void ${className}::${name}(${params})\n{\n    tkd_calls.push_back("${name}");\n}`,
  );
}

function layoutHarness(module: string, doc: TkuiDocument, ids: readonly string[]): string {
  const rootId = doc.root.id;
  const members = new Set([...walkNodes(doc)].map((n) => n.id));
  return `${EXPOSE_MEMBERS}#include "${module}.hpp"
#undef private
#include <iostream>

static void record(const char* id, const cpp_tk::Widget& w, const cpp_tk::Widget& root, bool& first)
{
    std::cout << (first ? "" : ",") << "\\"" << id << "\\":{\\"rect\\":["
              << w.winfo_rootx() - root.winfo_rootx() << "," << w.winfo_rooty() - root.winfo_rooty() << ","
              << w.winfo_width() << "," << w.winfo_height() << "],\\"mapped\\":"
              << (w.winfo_ismapped() ? "true" : "false") << "}";
    first = false;
}

int main()
{
    ${toClassName(module)} ui;
    ui.update();
    ui.update();
    bool first = true;
    std::cout << "{";
${ids
  .filter((id) => members.has(id))
  .map((id) => `    record("${id}", ${id === rootId ? 'ui' : `ui.${id}`}, ui, first);`)
  .join('\n')}
    std::cout << "}" << std::endl;
    return 0;
}
`;
}

function toplevelHarness(): string {
  return `${EXPOSE_MEMBERS}#include "dialog.hpp"
#undef private
#include <iostream>

int main()
{
    cpp_tk::Tk root;
    Dialog dialog(root);
    root.update();
    root.update();
    const cpp_tk::Widget& w = dialog;
    std::cout << "[\\"title=" << w.call({"wm", "title", w.full_name()}) << "\\","
              << "\\"size=" << w.winfo_width() << "x" << w.winfo_height() << "\\","
              << "\\"resizable=" << w.call({"wm", "resizable", w.full_name()}) << "\\"]" << std::endl;
    return 0;
}
`;
}

function frameHarness(): string {
  return `${EXPOSE_MEMBERS}#include "settings_panel.hpp"
#undef private
#include <iostream>
#include <string>
#include <thread>
#include <vector>

std::vector<std::string> tkd_calls;

int main()
{
    cpp_tk::Tk root;
    SettingsPanel panel(root);
    panel.pack({{"fill", "both"}, {"expand", true}});
    root.update();

    // 生成したクラス自身が Widget なので、別スレッドから post() で GUI の操作を依頼できる
    std::thread worker([&panel]() { panel.post([]() { tkd_calls.push_back("posted"); }); });
    worker.join();
    root.update();

    panel.event_generate("<<Probe>>");
    root.update();
    tkd_calls.push_back("class=" + panel.winfo_class());
    tkd_calls.push_back("text=" + panel.cget("text"));
    tkd_calls.push_back("parent=" + panel.winfo_parent());
    tkd_calls.push_back(std::string("mapped=") + (panel.tabs.winfo_ismapped() ? "1" : "0"));
    std::cout << "[";
    for (size_t i = 0; i < tkd_calls.size(); ++i) std::cout << (i ? "," : "") << "\\"" << tkd_calls[i] << "\\"";
    std::cout << "]" << std::endl;
    return 0;
}
`;
}

function cmakeLists(targets: readonly string[]): string {
  return `cmake_minimum_required(VERSION 3.16)
project(tkd_verify_cpp CXX)

set(CPP_TK_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(CPP_TK_BUILD_TESTS OFF CACHE BOOL "" FORCE)
add_subdirectory(\${CPP_TK_DIR} cpp_tk)

foreach(name ${targets.join(' ')})
    add_executable(\${name} \${name}.cpp \${name}_main.cpp)
    target_include_directories(\${name} PRIVATE \${CPP_TK_DIR})
    target_link_libraries(\${name} PRIVATE cpp_tk)
    set_target_properties(\${name} PROPERTIES RUNTIME_OUTPUT_DIRECTORY \${CMAKE_BINARY_DIR}/bin)
endforeach()
`;
}

function run(module: string): unknown {
  const output = execFileSync(join(buildDir, 'bin', module), { encoding: 'utf8' });
  const lastLine = output.trim().split(/\r?\n/).pop() ?? '';
  return JSON.parse(lastLine);
}
