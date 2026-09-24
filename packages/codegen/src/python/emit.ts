/**
 * Python（tkinter）のコード生成（docs/codegen-design.md）。
 * 中間表現から、各マーカー区間の中身・新規ファイルの雛形・ハンドラの雛形を作る。
 */
import type { LiteralValue, Variable } from '@tk-designer/core';
import type { GenHandler, GenModel, GenValue, GenWidget } from '../model.ts';
import type { GeneratedCode, Region } from '../region.ts';

const INDENT = '    ';

/** Python のキーワードと重なるオプション名は、tkinter の慣習どおり末尾に _ を付ける */
const KEYWORD_OPTIONS: ReadonlySet<string> = new Set(['class', 'from', 'in', 'is', 'as', 'global']);

export function emitPython(model: GenModel, sourceName: string): GeneratedCode {
  const regions: Region[] = [
    { id: 'declarations', content: declarations(model), indent: 2 },
    { id: 'tkd_create_widgets', content: createWidgets(model), indent: 1 },
    { id: 'tkd_apply_layout', content: applyLayout(model), indent: 1 },
    { id: 'tkd_bind_events', content: bindEvents(model), indent: 1 },
  ];
  return {
    regions,
    stubs: model.handlers.map((h) => ({ name: h.name, code: handlerStub(h) })),
    scaffold: (rendered) => scaffold(model, sourceName, rendered),
  };
}

// ---- 区間の中身 ----------------------------------------------------------------

function declarations(model: GenModel): string {
  const lines = [
    `self.${model.root.id}: ${pyClass(model.root.className)}`,
    ...model.variables.map(([name, v]) => `self.${name}: tk.${v.type}`),
    ...model.widgets.map((w) => `self.${w.id}: ${pyClass(w.className)}`),
  ];
  return block(2, lines);
}

function createWidgets(model: GenModel): string {
  const root = model.root;
  const rootArgs = model.root.className === 'tk.Toplevel' ? ['self.master'] : [];
  const lines: string[] = [
    `def tkd_create_widgets(self):`,
    `${INDENT}self.${root.id} = ${pyClass(root.className)}(${[...rootArgs, ...kwargs(root.options.filter((o) => o.creationOnly))].join(', ')})`,
    ...windowSettings(model),
  ];
  const rootConfig = kwargs(root.options.filter((o) => !o.creationOnly));
  if (rootConfig.length > 0)
    lines.push(`${INDENT}self.${root.id}.configure(${rootConfig.join(', ')})`);

  if (model.variables.length > 0) lines.push('');
  for (const [name, variable] of model.variables)
    lines.push(`${INDENT}${variableCreation(model, name, variable)}`);

  if (model.widgets.length > 0) lines.push('');
  for (const widget of model.widgets) {
    const args = [`self.${widget.parentId ?? model.root.id}`, ...kwargs(widget.options)];
    lines.push(`${INDENT}self.${widget.id} = ${pyClass(widget.className)}(${args.join(', ')})`);
  }
  return block(1, lines);
}

function windowSettings(model: GenModel): string[] {
  const w = model.window;
  const target = `${INDENT}self.${model.root.id}`;
  return [
    ...(w.title !== undefined ? [`${target}.title(${pyString(w.title)})`] : []),
    ...(w.geometry !== undefined ? [`${target}.geometry(${pyString(w.geometry)})`] : []),
    ...(w.resizable
      ? [`${target}.resizable(${pyBool(w.resizable[0])}, ${pyBool(w.resizable[1])})`]
      : []),
    ...(w.minsize ? [`${target}.minsize(${String(w.minsize[0])}, ${String(w.minsize[1])})`] : []),
    ...(w.maxsize ? [`${target}.maxsize(${String(w.maxsize[0])}, ${String(w.maxsize[1])})`] : []),
  ];
}

function variableCreation(model: GenModel, name: string, variable: Variable): string {
  const args = [`master=self.${model.root.id}`];
  if (variable.value !== undefined) args.push(`value=${pyLiteral(variable.value)}`);
  return `self.${name} = tk.${variable.type}(${args.join(', ')})`;
}

function applyLayout(model: GenModel): string {
  const lines: string[] = ['def tkd_apply_layout(self):'];
  const containers = [model.root, ...model.widgets];
  const byParent = new Map<string, GenWidget[]>();
  for (const w of model.widgets) {
    if (!w.parentId) continue;
    byParent.set(w.parentId, [...(byParent.get(w.parentId) ?? []), w]);
  }

  // 親ごとに「コンテナの設定 → 子の配置（children の順）」の順に書く。pack はこの順序が配置結果に影響する
  for (const container of containers) {
    const children = byParent.get(container.id) ?? [];
    const containerLines = [...containerSettings(container), ...children.map(placement)];
    if (containerLines.length === 0) continue;
    if (lines.length > 1) lines.push('');
    lines.push(...containerLines.map((l) => `${INDENT}${l}`));
  }
  if (lines.length === 1) lines.push(`${INDENT}pass`);
  return block(1, lines);
}

function containerSettings(container: GenWidget): string[] {
  const layout = container.layout;
  if (!layout) return [];
  const self = `self.${container.id}`;
  const lines: string[] = [];
  if (layout.manager === 'grid') {
    for (const [axis, lines_] of [
      ['column', layout.columns],
      ['row', layout.rows],
    ] as const) {
      for (const [index, config] of Object.entries(lines_ ?? {})) {
        const args = Object.entries(config).map(([k, v]) => `${k}=${pyLiteral(v)}`);
        lines.push(`${self}.grid_${axis}configure(${index}, ${args.join(', ')})`);
      }
    }
  }
  if ('propagate' in layout && layout.propagate !== undefined) {
    lines.push(`${self}.${layout.manager}_propagate(${pyBool(layout.propagate)})`);
  }
  return lines;
}

function placement(widget: GenWidget): string {
  const self = `self.${widget.id}`;
  const args = Object.entries(widget.placement).map(([k, v]) => `${k}=${pyLiteral(v)}`);
  switch (widget.parentKind) {
    case 'notebook':
    case 'paned':
      return `self.${widget.parentId ?? ''}.add(${[self, ...args].join(', ')})`;
    case 'pack':
    case 'grid':
    case 'place':
      return `${self}.${widget.parentKind}(${args.join(', ')})`;
    case undefined:
      // 親が子の置き方を持たない（検証エラーの状態）。配置しない
      return `# ${widget.id}: 親の layout が未設定のため配置しない`;
  }
}

function bindEvents(model: GenModel): string {
  const lines = ['def tkd_bind_events(self):'];
  for (const event of model.events) {
    const handler = `self.${event.handler}`;
    lines.push(
      event.kind === 'option'
        ? `${INDENT}self.${event.widgetId}.configure(${optionName(event.name)}=${handler})`
        : `${INDENT}self.${event.widgetId}.bind(${pyString(event.name)}, ${handler})`,
    );
  }
  if (lines.length === 1) lines.push(`${INDENT}pass`);
  return block(1, lines);
}

// ---- ハンドラ・雛形 ------------------------------------------------------------

function handlerStub(handler: GenHandler): string {
  const params = { none: 'self', value: 'self, value', event: 'self, event' }[handler.signature];
  return block(1, [`def ${handler.name}(${params}):`, `${INDENT}pass`]);
}

function scaffold(model: GenModel, sourceName: string, rendered: (id: string) => string): string {
  const isToplevel = model.root.className === 'tk.Toplevel';
  const init = isToplevel
    ? [`${INDENT}def __init__(self, master):`, `${INDENT}${INDENT}self.master = master`]
    : [`${INDENT}def __init__(self):`];
  const lines = [
    'import tkinter as tk',
    'from tkinter import ttk',
    '',
    '',
    `class ${model.className}:`,
    `${INDENT}"""tk-designer で作成した画面（${sourceName}）。マーカーで囲まれた区間は再生成で上書きされる。"""`,
    '',
    ...init,
    rendered('declarations'),
    '',
    `${INDENT}${INDENT}self.tkd_create_widgets()`,
    `${INDENT}${INDENT}self.tkd_apply_layout()`,
    `${INDENT}${INDENT}self.tkd_bind_events()`,
    '',
    rendered('tkd_create_widgets'),
    '',
    rendered('tkd_apply_layout'),
    '',
    rendered('tkd_bind_events'),
    '',
    ...(isToplevel
      ? []
      : [`${INDENT}def run(self):`, `${INDENT}${INDENT}self.${model.root.id}.mainloop()`, '']),
    `${INDENT}# <tk-designer:handler-stubs>`,
    ...model.handlers.flatMap((h) => ['', handlerStub(h).trimEnd()]),
    ...(isToplevel
      ? []
      : ['', '', 'if __name__ == "__main__":', `${INDENT}${model.className}().run()`]),
  ];
  return `${lines.join('\n')}\n`;
}

// ---- 値の書き方 ----------------------------------------------------------------

function kwargs(options: GenWidget['options']): string[] {
  return options.map((o) => `${optionName(o.name)}=${pyValue(o.value)}`);
}

function optionName(name: string): string {
  return KEYWORD_OPTIONS.has(name) ? `${name}_` : name;
}

function pyValue(value: GenValue): string {
  return value.kind === 'var' ? `self.${value.name}` : pyLiteral(value.value);
}

export function pyLiteral(value: LiteralValue): string {
  if (Array.isArray(value)) {
    const items = (value as readonly LiteralValue[]).map(pyLiteral);
    return items.length === 1 ? `(${items[0] ?? ''},)` : `(${items.join(', ')})`;
  }
  if (typeof value === 'boolean') return pyBool(value);
  if (typeof value === 'number') return String(value);
  return pyString(value as string);
}

/** JSON の文字列表現は Python の文字列リテラルとしても有効 */
function pyString(value: string): string {
  return JSON.stringify(value);
}

function pyBool(value: boolean): string {
  return value ? 'True' : 'False';
}

function pyClass(className: string): string {
  return className; // "tk.Button" / "ttk.Button" は import の別名と一致する
}

function block(level: number, lines: readonly string[]): string {
  const prefix = INDENT.repeat(level);
  return lines.map((l) => (l === '' ? '' : `${prefix}${l}`)).join('\n');
}
