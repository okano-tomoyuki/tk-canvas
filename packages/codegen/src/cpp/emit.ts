/**
 * C++（cpp_tk）のコード生成（docs/codegen-design.md §3）。
 * ヘッダ（宣言の区間）とソース（生成・配置・イベントの区間、ハンドラの雛形）の2ファイルを作る。
 */
import { ROOT_CLASSES, type LiteralValue, type Variable } from '@tk-designer/core';
import type { GenHandler, GenModel, GenOption, GenValue, GenWidget } from '../model.ts';
import type { GeneratedCode, Region } from '../region.ts';

const INDENT = '    ';

export interface CppFiles {
  readonly header: GeneratedCode;
  readonly source: GeneratedCode;
}

/**
 * @param headerInclude ソースから見たヘッダの include パス
 */
export function emitCpp(model: GenModel, sourceName: string, headerInclude: string): CppFiles {
  const declarations: Region = { id: 'declarations', content: declarationLines(model), indent: 1 };
  const sourceRegions: Region[] = [
    { id: 'tkd_create_widgets', content: createWidgets(model), indent: 0 },
    { id: 'tkd_apply_layout', content: applyLayout(model), indent: 0 },
    { id: 'tkd_bind_events', content: bindEvents(model), indent: 0 },
  ];

  const header: GeneratedCode = {
    regions: [declarations],
    stubs: [],
    scaffold: (rendered) => headerScaffold(model, sourceName, rendered),
    baseClass: {
      className: model.className,
      expected: cppClass(model.root.className),
      known: ROOT_CLASSES.map((c) => cppClass(c)),
    },
  };
  const source: GeneratedCode = {
    regions: sourceRegions,
    stubs: model.handlers.map((h) => ({ name: h.name, code: handlerStub(model.className, h) })),
    scaffold: (rendered) => sourceScaffold(model, headerInclude, rendered),
  };
  return { header, source };
}

// ---- ヘッダ --------------------------------------------------------------------

function declarationLines(model: GenModel): string {
  const lines: string[] = [];
  // ルート（基底クラス）はメンバより先に構築されるため、変数・ウィジェットの宣言順は構築に影響しない
  for (const [name, variable] of model.variables) lines.push(`cpp_tk::${variable.type} ${name};`);
  for (const widget of model.widgets) lines.push(`${cppClass(widget.className)} ${widget.id};`);
  lines.push(
    '',
    'void tkd_create_widgets();',
    'void tkd_apply_layout();',
    'void tkd_bind_events();',
  );
  if (model.handlers.length > 0) lines.push('');
  for (const handler of model.handlers)
    lines.push(`void ${handler.name}(${handlerParams(handler)});`);
  return indent(1, lines);
}

function headerScaffold(
  model: GenModel,
  sourceName: string,
  rendered: (id: string) => string,
): string {
  const name = model.className;
  return `${[
    '#pragma once',
    '',
    '#include "cpp_tk.hpp"',
    '',
    `/** tk-designer で作成した画面（${sourceName}）。マーカーで囲まれた区間は再生成で上書きされる。 */`,
    `class ${name} : public ${cppClass(model.root.className)}`,
    '{',
    'public:',
    model.root.className === 'tk.Tk'
      ? `${INDENT}${name}();`
      : `${INDENT}explicit ${name}(const cpp_tk::Widget& parent, const std::map<std::string, cpp_tk::ArgValue>& options = {});`,
    // コールバックが this を捕捉するため、コピー・移動はできない
    `${INDENT}${name}(const ${name}&) = delete;`,
    `${INDENT}${name}& operator=(const ${name}&) = delete;`,
    '',
    'private:',
    rendered('declarations'),
    '};',
  ].join('\n')}\n`;
}

// ---- ソース --------------------------------------------------------------------

function createWidgets(model: GenModel): string {
  const lines: string[] = [`void ${model.className}::tkd_create_widgets()`, '{'];
  lines.push(...windowSettings(model));
  if (model.root.options.length > 0)
    lines.push(`${INDENT}config(${optionMap(model.root.options)});`);

  const initial = model.variables.filter(([, v]) => v.value !== undefined);
  if (initial.length > 0 && lines.length > 2) lines.push('');
  for (const [name, variable] of initial)
    lines.push(`${INDENT}${name}.set(${variableValue(variable)});`);

  if (model.widgets.length > 0 && lines.length > 2) lines.push('');
  for (const widget of model.widgets) {
    const parent = member(model, widget.parentId, 'as_parent()');
    lines.push(
      `${INDENT}${widget.id} = ${cppClass(widget.className, 'tk')}(${parent}${mapArg(widget.options)});`,
    );
  }
  lines.push('}');
  return lines.join('\n');
}

function windowSettings(model: GenModel): string[] {
  const w = model.window;
  const lines: string[] = [];
  if (w.title !== undefined) lines.push(`title(${cppString(w.title)});`);
  if (w.geometry !== undefined) {
    lines.push(`geometry(${cppString(w.geometry)});`);
  } else if (model.root.className === 'tk.Tk') {
    // cpp_tk の Tk() は geometry("300x300") を設定するため、Tkinter と同じく要求サイズに戻す
    lines.push('geometry("");');
  }
  if (w.resizable) lines.push(`resizable(${String(w.resizable[0])}, ${String(w.resizable[1])});`);
  if (w.minsize) lines.push(`minsize(${String(w.minsize[0])}, ${String(w.minsize[1])});`);
  if (w.maxsize) lines.push(`maxsize(${String(w.maxsize[0])}, ${String(w.maxsize[1])});`);
  return lines.map((l) => `${INDENT}${l}`);
}

/** ウィジェット id のメンバ関数の呼び出し。ルートは生成クラス自身なので、基底クラスのメンバ関数を直接呼ぶ */
function member(model: GenModel, id: string | undefined, call: string): string {
  return id === undefined || id === model.root.id ? call : `${id}.${call}`;
}

function variableValue(variable: Variable): string {
  switch (variable.type) {
    case 'StringVar':
      return cppString(variable.value ?? '');
    case 'IntVar':
      return String(variable.value ?? 0);
    case 'DoubleVar':
      return cppDouble(variable.value ?? 0);
    case 'BooleanVar':
      return String(variable.value ?? false);
  }
}

function applyLayout(model: GenModel): string {
  const lines: string[] = [`void ${model.className}::tkd_apply_layout()`, '{'];
  const byParent = new Map<string, GenWidget[]>();
  for (const w of model.widgets) {
    if (w.parentId) byParent.set(w.parentId, [...(byParent.get(w.parentId) ?? []), w]);
  }
  let first = true;
  for (const container of [model.root, ...model.widgets]) {
    const children = byParent.get(container.id) ?? [];
    const block = [...containerSettings(model, container), ...children.flatMap(placement)];
    if (block.length === 0) continue;
    if (!first) lines.push('');
    first = false;
    lines.push(...block.map((l) => `${INDENT}${l}`));
  }
  lines.push('}');
  return lines.join('\n');
}

function containerSettings(model: GenModel, container: GenWidget): string[] {
  const layout = container.layout;
  if (!layout) return [];
  const lines: string[] = [];
  if (layout.manager === 'grid') {
    for (const [axis, configs] of [
      ['column', layout.columns],
      ['row', layout.rows],
    ] as const) {
      for (const [index, config] of Object.entries(configs ?? {})) {
        const call = member(model, container.id, `grid_${axis}configure`);
        lines.push(`${call}(${index}, ${literalMap(Object.entries(config))});`);
      }
    }
  }
  if ('propagate' in layout && layout.propagate !== undefined) {
    const call = member(model, container.id, `${layout.manager}_propagate`);
    lines.push(`${call}(${String(layout.propagate)});`);
  }
  return lines;
}

function placement(widget: GenWidget): string[] {
  const entries = Object.entries(widget.placement);
  const parent = widget.parentId ?? '';
  switch (widget.parentKind) {
    case 'notebook': {
      // cpp_tk の Notebook は add_tab(child, label) のみ。ラベル以外の指定は tab() で設定する
      const text = typeof widget.placement.text === 'string' ? widget.placement.text : '';
      const rest = entries.filter(([k]) => k !== 'text');
      return [
        `${parent}.add_tab(${widget.id}, ${cppString(text)});`,
        ...(rest.length > 0
          ? [`${parent}.tab(${widget.id}.full_name(), ${literalMap(rest)});`]
          : []),
      ];
    }
    case 'paned':
      return [
        `${parent}.add(${widget.id}${entries.length > 0 ? `, ${literalMap(entries)}` : ''});`,
      ];
    case 'pack':
    case 'grid':
    case 'place':
      return [
        `${widget.id}.${widget.parentKind}(${entries.length > 0 ? literalMap(entries) : ''});`,
      ];
    case undefined:
      return [`// ${widget.id}: 親の layout が未設定のため配置しない`];
  }
}

function bindEvents(model: GenModel): string {
  const lines: string[] = [`void ${model.className}::tkd_bind_events()`, '{'];
  const signatures = new Map(model.handlers.map((h) => [h.name, h.signature]));
  for (const event of model.events) {
    if (event.kind === 'bind') {
      const call = member(model, event.widgetId, 'bind');
      lines.push(
        `${INDENT}${call}(${cppString(event.name)}, [this](const tk::Event& event) { ${event.handler}(event); });`,
      );
      continue;
    }
    const call = member(model, event.widgetId, event.name);
    lines.push(
      signatures.get(event.handler) === 'value'
        ? `${INDENT}${call}([this](const double& value) { ${event.handler}(value); });`
        : `${INDENT}${call}([this]() { ${event.handler}(); });`,
    );
  }
  lines.push('}');
  return lines.join('\n');
}

function handlerParams(handler: GenHandler): string {
  switch (handler.signature) {
    case 'none':
      return '';
    case 'value':
      return 'const double& value';
    case 'event':
      return 'const cpp_tk::Event& event';
  }
}

function handlerStub(className: string, handler: GenHandler): string {
  const params = handlerParams(handler).replace('cpp_tk::', 'tk::');
  return [`void ${className}::${handler.name}(${params})`, '{', `${INDENT}// TODO: 実装`, '}'].join(
    '\n',
  );
}

function sourceScaffold(
  model: GenModel,
  headerInclude: string,
  rendered: (id: string) => string,
): string {
  const name = model.className;
  const constructor =
    model.root.className === 'tk.Tk'
      ? [`${name}::${name}()`]
      : [
          `${name}::${name}(const cpp_tk::Widget& parent, const std::map<std::string, cpp_tk::ArgValue>& options)`,
          `${INDENT}: ${cppClass(model.root.className)}(parent, options)`,
        ];
  const lines = [
    `#include "${headerInclude}"`,
    '',
    'namespace tk = cpp_tk;',
    'namespace ttk = cpp_tk::ttk;',
    '',
    ...constructor,
    '{',
    `${INDENT}tkd_create_widgets();`,
    `${INDENT}tkd_apply_layout();`,
    `${INDENT}tkd_bind_events();`,
    '}',
    '',
    rendered('tkd_create_widgets'),
    '',
    rendered('tkd_apply_layout'),
    '',
    rendered('tkd_bind_events'),
    '',
    '// <tk-designer:handler-stubs>',
    ...model.handlers.flatMap((h) => ['', handlerStub(name, h)]),
  ];
  return `${lines.join('\n')}\n`;
}

// ---- 値の書き方 ----------------------------------------------------------------

function mapArg(options: readonly GenOption[]): string {
  return options.length > 0 ? `, ${optionMap(options)}` : '';
}

function optionMap(options: readonly GenOption[]): string {
  return `{${options.map((o) => `{${cppString(o.name)}, ${cppValue(o.value)}}`).join(', ')}}`;
}

function literalMap(entries: readonly (readonly [string, LiteralValue | undefined])[]): string {
  const items = entries.filter((e): e is readonly [string, LiteralValue] => e[1] !== undefined);
  return `{${items.map(([k, v]) => `{${cppString(k)}, ${cppLiteral(v)}}`).join(', ')}}`;
}

function cppValue(value: GenValue): string {
  // 変数は ArgValue(Var&) で名前として渡る
  return value.kind === 'var' ? value.name : cppLiteral(value.value);
}

export function cppLiteral(value: LiteralValue): string {
  if (Array.isArray(value)) {
    return `std::vector<tk::ArgValue>{${(value as readonly LiteralValue[]).map(cppLiteral).join(', ')}}`;
  }
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : cppDouble(value);
  return cppString(value as string);
}

function cppDouble(value: number): string {
  const text = String(value);
  return /[.e]/.test(text) ? text : `${text}.0`;
}

/** JSON の文字列表現は C++ の文字列リテラルとしても有効（\uXXXX は UTF-8 に変換される） */
function cppString(value: string): string {
  return JSON.stringify(value);
}

/** "ttk.Entry" → "cpp_tk::ttk::Entry"。ns を指定すると名前空間の別名を使う（"tk" → "ttk::Entry" / "tk::Button"） */
function cppClass(className: string, ns?: 'tk'): string {
  const [library, name = ''] = className.split('.');
  if (ns) return library === 'ttk' ? `ttk::${name}` : `tk::${name}`;
  return library === 'ttk' ? `cpp_tk::ttk::${name}` : `cpp_tk::${name}`;
}

function indent(level: number, lines: readonly string[]): string {
  const prefix = INDENT.repeat(level);
  return lines.map((l) => (l === '' ? '' : `${prefix}${l}`)).join('\n');
}
