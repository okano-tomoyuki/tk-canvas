/**
 * ウィジェットカタログの手書きの補足情報（docs/adr/0007）。
 * Tk から自動抽出できない情報（分類、子の置き方、変数型、command のシグネチャ、イベント候補など）を定義する。
 * 頻出ウィジェットから順に整備する。ここに無いクラスも抽出結果だけで使える（curated = false）。
 */
import type { VariableType } from '../dsl/schema.ts';
import type { ChildrenKind, OptionType, WidgetCategory } from './types.ts';

export interface ClassOverlay {
  readonly category: WidgetCategory;
  readonly children?: ChildrenKind;
  readonly commonOptions?: readonly string[];
  /** 共通のイベント候補に加えて提示するもの */
  readonly events?: readonly string[];
  /** 自動推定した型の上書き */
  readonly optionTypes?: Readonly<Record<string, OptionType>>;
}

/** すべてのウィジェットに提示するイベント候補 */
export const COMMON_EVENTS: readonly string[] = [
  '<Button-1>',
  '<Double-Button-1>',
  '<ButtonRelease-1>',
  '<Button-3>',
  '<Enter>',
  '<Leave>',
  '<FocusIn>',
  '<FocusOut>',
  '<KeyPress>',
  '<Configure>',
];

const NO_ARG_COMMAND: OptionType = { kind: 'callback', signature: 'none' };
const VALUE_COMMAND: OptionType = { kind: 'callback', signature: 'value' };

function variable(...variableTypes: VariableType[]): OptionType {
  return { kind: 'variable', variableTypes };
}

const STRING_VAR = variable('StringVar');
const NUMERIC_VAR = variable('DoubleVar', 'IntVar');

/** ttk の state は Tk 上は任意の文字列を受け付けるが、実際に使う値に絞る */
const TTK_STATE: OptionType = { kind: 'enum', values: ['normal', 'disabled'] };
const TTK_EDITABLE_STATE: OptionType = { kind: 'enum', values: ['normal', 'disabled', 'readonly'] };

const WINDOW_OPTIONS = ['background', 'menu', 'padx', 'pady'];
const FRAME_OPTIONS = ['padding', 'relief', 'borderwidth', 'width', 'height', 'style'];
const TEXT_LIKE_OPTIONS = ['text', 'textvariable', 'image', 'compound', 'width', 'state', 'style'];

export const CLASS_OVERLAYS: Readonly<Record<string, ClassOverlay>> = {
  // ---- ウィンドウ ----
  'tk.Tk': { category: 'window', children: 'layout', commonOptions: WINDOW_OPTIONS },
  'tk.Toplevel': { category: 'window', children: 'layout', commonOptions: WINDOW_OPTIONS },

  // ---- コンテナ ----
  'ttk.Frame': { category: 'container', children: 'layout', commonOptions: FRAME_OPTIONS },
  'ttk.Labelframe': {
    category: 'container',
    children: 'layout',
    commonOptions: ['text', 'labelanchor', ...FRAME_OPTIONS],
  },
  'ttk.Notebook': {
    category: 'container',
    children: 'notebook',
    commonOptions: ['width', 'height', 'padding', 'style'],
    events: ['<<NotebookTabChanged>>'],
  },
  'ttk.PanedWindow': {
    category: 'container',
    children: 'paned',
    commonOptions: ['orient', 'width', 'height', 'style'],
  },
  'tk.Frame': {
    category: 'container',
    children: 'layout',
    commonOptions: ['background', 'relief', 'borderwidth', 'width', 'height', 'padx', 'pady'],
  },
  'tk.LabelFrame': {
    category: 'container',
    children: 'layout',
    commonOptions: ['text', 'labelanchor', 'background', 'relief', 'borderwidth', 'padx', 'pady'],
  },

  // ---- 基本 ----
  'ttk.Button': {
    category: 'basic',
    commonOptions: ['text', 'command', ...TEXT_LIKE_OPTIONS.slice(1)],
    optionTypes: { command: NO_ARG_COMMAND, textvariable: STRING_VAR, state: TTK_STATE },
  },
  'ttk.Label': {
    category: 'basic',
    commonOptions: [...TEXT_LIKE_OPTIONS, 'anchor', 'justify', 'wraplength', 'font', 'foreground'],
    optionTypes: { textvariable: STRING_VAR, state: TTK_STATE },
  },
  'ttk.Separator': { category: 'display', commonOptions: ['orient', 'style'] },
  'ttk.Progressbar': {
    category: 'display',
    commonOptions: ['orient', 'length', 'mode', 'maximum', 'value', 'variable', 'style'],
    optionTypes: { variable: NUMERIC_VAR },
  },
  'ttk.Scrollbar': { category: 'other', commonOptions: ['orient', 'style'] },

  // ---- 入力 ----
  'ttk.Entry': {
    category: 'input',
    commonOptions: ['textvariable', 'width', 'state', 'show', 'justify', 'font', 'style'],
    events: ['<Return>', '<KeyRelease>'],
    optionTypes: { textvariable: STRING_VAR, state: TTK_EDITABLE_STATE },
  },
  'ttk.Spinbox': {
    category: 'input',
    commonOptions: [
      'textvariable',
      'from',
      'to',
      'increment',
      'values',
      'width',
      'state',
      'command',
      'style',
    ],
    events: ['<Return>', '<<Increment>>', '<<Decrement>>'],
    optionTypes: {
      command: NO_ARG_COMMAND,
      textvariable: STRING_VAR,
      values: { kind: 'list' },
      state: TTK_EDITABLE_STATE,
    },
  },
  'ttk.Scale': {
    category: 'input',
    commonOptions: ['orient', 'from', 'to', 'variable', 'value', 'length', 'command', 'style'],
    optionTypes: { command: VALUE_COMMAND, variable: NUMERIC_VAR, state: TTK_STATE },
  },
  'tk.Text': {
    category: 'input',
    commonOptions: ['width', 'height', 'wrap', 'font', 'state', 'background', 'foreground', 'undo'],
    events: ['<<Modified>>', '<<Selection>>', '<KeyRelease>'],
  },

  // ---- 選択 ----
  'ttk.Checkbutton': {
    category: 'selection',
    commonOptions: ['text', 'variable', 'onvalue', 'offvalue', 'command', 'state', 'style'],
    optionTypes: {
      command: NO_ARG_COMMAND,
      variable: variable('BooleanVar', 'IntVar', 'StringVar'),
      textvariable: STRING_VAR,
      state: TTK_STATE,
    },
  },
  'ttk.Radiobutton': {
    category: 'selection',
    commonOptions: ['text', 'variable', 'value', 'command', 'state', 'style'],
    optionTypes: {
      command: NO_ARG_COMMAND,
      variable: variable('StringVar', 'IntVar'),
      textvariable: STRING_VAR,
      state: TTK_STATE,
    },
  },
  'ttk.Combobox': {
    category: 'selection',
    commonOptions: ['textvariable', 'values', 'state', 'width', 'height', 'justify', 'style'],
    events: ['<<ComboboxSelected>>', '<Return>'],
    optionTypes: { textvariable: STRING_VAR, values: { kind: 'list' }, state: TTK_EDITABLE_STATE },
  },
  'tk.Listbox': {
    category: 'selection',
    commonOptions: ['listvariable', 'selectmode', 'height', 'width', 'exportselection', 'font'],
    events: ['<<ListboxSelect>>'],
    optionTypes: { listvariable: STRING_VAR },
  },
  'ttk.Treeview': {
    category: 'selection',
    commonOptions: ['columns', 'show', 'selectmode', 'height', 'displaycolumns', 'style'],
    events: ['<<TreeviewSelect>>', '<<TreeviewOpen>>', '<<TreeviewClose>>'],
    optionTypes: { columns: { kind: 'list' }, displaycolumns: { kind: 'list' } },
  },

  // ---- 表示 ----
  'tk.Canvas': {
    category: 'display',
    commonOptions: ['width', 'height', 'background', 'scrollregion', 'highlightthickness'],
  },
};

/** クラスを問わず適用する型の上書き（オーバーレイ未整備のクラスにも効く） */
export const GENERIC_OPTION_TYPES: Readonly<Record<string, OptionType>> = {
  textvariable: STRING_VAR,
  listvariable: STRING_VAR,
};
