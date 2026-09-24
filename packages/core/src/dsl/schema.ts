/**
 * DSL（*.tkui.json）の構造スキーマ。型と JSON Schema はここから導出する（docs/adr/0009）。
 * 仕様の説明は docs/dsl-spec.md を参照。ここでは形・型・列挙値だけを検証し、
 * 名前の重複や参照の解決などの意味的な検証は validate.ts で行う。
 */
import * as z from 'zod';

export const FORMAT_VERSION = 1;

// ---------------------------------------------------------------------------
// 共通の値
// ---------------------------------------------------------------------------

/** 識別子の形式（キーワード等の詳細な検査は意味の検証で行う） */
const Identifier = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/);

/** 名前空間つきのウィジェットクラス名（例: "ttk.Button"） */
const WidgetClassName = z.string().regex(/^(tk|ttk)\.[A-Z][A-Za-z]*$/);

const NonNegativeInt = z.int().nonnegative();

/** 余白: 1値（両側同じ）または [前, 後] */
const Pad = z.union([
  z.number().nonnegative(),
  z.tuple([z.number().nonnegative(), z.number().nonnegative()]),
]);

export const Anchor = z.enum(['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw', 'center']);

/** "n" "s" "e" "w" の組み合わせ（重複なし）。空文字は「中央」 */
const Sticky = z
  .string()
  .regex(/^(?!.*(.).*\1)[nsew]*$/, 'n, s, e, w の重複しない組み合わせで指定する');

// ---------------------------------------------------------------------------
// オプション値と参照
// ---------------------------------------------------------------------------

export const VariableRef = z.strictObject({ var: Identifier }).meta({
  id: 'VariableRef',
  description: 'variables に定義した変数への参照',
});

export const HandlerRef = z.strictObject({ handler: Identifier }).meta({
  id: 'HandlerRef',
  description: 'イベントハンドラ（メソッド名）への参照',
});

type LiteralValue = string | number | boolean | readonly LiteralValue[];

/** リテラル値。配列は Tcl のリストに対応し、入れ子にできる（例: font の ["Arial", 12, "bold"]） */
export const LiteralValue: z.ZodType<LiteralValue> = z
  .union([z.string(), z.number(), z.boolean(), z.array(z.lazy(() => LiteralValue)).readonly()])
  .meta({ id: 'LiteralValue' });

export const OptionValue = z.union([LiteralValue, VariableRef, HandlerRef]);

// ---------------------------------------------------------------------------
// 変数
// ---------------------------------------------------------------------------

export const Variable = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('StringVar'), value: z.string().optional() }),
  z.strictObject({ type: z.literal('IntVar'), value: z.int().optional() }),
  z.strictObject({ type: z.literal('DoubleVar'), value: z.number().optional() }),
  z.strictObject({ type: z.literal('BooleanVar'), value: z.boolean().optional() }),
]);

export const VARIABLE_TYPES = ['StringVar', 'IntVar', 'DoubleVar', 'BooleanVar'] as const;
export type VariableType = (typeof VARIABLE_TYPES)[number];

// ---------------------------------------------------------------------------
// layout（コンテナが子をどう並べるか）
// ---------------------------------------------------------------------------

const GridLineConfig = z.strictObject({
  weight: NonNegativeInt.optional(),
  minsize: NonNegativeInt.optional(),
  pad: NonNegativeInt.optional(),
  uniform: z.string().optional(),
});

/** キーは行・列の番号（JSON のキーは文字列のため "0", "1", ... と書く） */
const GridLines = z.record(z.string().regex(/^\d+$/), GridLineConfig);

export const Layout = z
  .discriminatedUnion('manager', [
    z.strictObject({ manager: z.literal('pack'), propagate: z.boolean().optional() }),
    z.strictObject({
      manager: z.literal('grid'),
      propagate: z.boolean().optional(),
      columns: GridLines.optional(),
      rows: GridLines.optional(),
    }),
    z.strictObject({ manager: z.literal('place') }),
  ])
  .meta({ id: 'Layout', description: 'このコンテナが子をどう並べるか' });

export type GeometryManager = z.infer<typeof Layout>['manager'];

// ---------------------------------------------------------------------------
// placement（子が親の中でどこに置かれるか）。どの形式かは親で決まる
// ---------------------------------------------------------------------------

export const PackPlacement = z.strictObject({
  side: z.enum(['top', 'bottom', 'left', 'right']).optional(),
  fill: z.enum(['none', 'x', 'y', 'both']).optional(),
  expand: z.boolean().optional(),
  anchor: Anchor.optional(),
  padx: Pad.optional(),
  pady: Pad.optional(),
  ipadx: z.number().nonnegative().optional(),
  ipady: z.number().nonnegative().optional(),
});

export const GridPlacement = z.strictObject({
  row: NonNegativeInt.optional(),
  column: NonNegativeInt.optional(),
  rowspan: z.int().positive().optional(),
  columnspan: z.int().positive().optional(),
  sticky: Sticky.optional(),
  padx: Pad.optional(),
  pady: Pad.optional(),
  ipadx: z.number().nonnegative().optional(),
  ipady: z.number().nonnegative().optional(),
});

export const PlacePlacement = z.strictObject({
  x: z.number().optional(),
  y: z.number().optional(),
  relx: z.number().optional(),
  rely: z.number().optional(),
  width: z.number().nonnegative().optional(),
  height: z.number().nonnegative().optional(),
  relwidth: z.number().nonnegative().optional(),
  relheight: z.number().nonnegative().optional(),
  anchor: Anchor.optional(),
  bordermode: z.enum(['inside', 'outside', 'ignore']).optional(),
});

/** ttk.Notebook の子: タブのオプション */
export const NotebookTabPlacement = z.strictObject({
  text: z.string().optional(),
  underline: z.int().optional(),
  sticky: Sticky.optional(),
  padding: z
    .union([
      z.number().nonnegative(),
      z.tuple([z.number().nonnegative(), z.number().nonnegative()]),
      z.tuple([
        z.number().nonnegative(),
        z.number().nonnegative(),
        z.number().nonnegative(),
        z.number().nonnegative(),
      ]),
    ])
    .optional(),
  state: z.enum(['normal', 'disabled', 'hidden']).optional(),
});

/** ttk.PanedWindow の子: ペインのオプション */
export const PanePlacement = z.strictObject({
  weight: NonNegativeInt.optional(),
});

/** 構造の検証では「いずれかの形式」であることだけを確認し、親との対応は意味の検証で確認する */
export const Placement = z
  .union([PackPlacement, GridPlacement, PlacePlacement, NotebookTabPlacement, PanePlacement])
  .meta({ id: 'Placement', description: 'この子が親の中でどこに置かれるか（形式は親で決まる）' });

// ---------------------------------------------------------------------------
// bindings
// ---------------------------------------------------------------------------

export const Binding = z.strictObject({
  sequence: z.string().regex(/^<.+>$/, '"<Return>" や "<<ComboboxSelected>>" の形式で指定する'),
  handler: Identifier,
});

// ---------------------------------------------------------------------------
// ノード
// ---------------------------------------------------------------------------

const Options = z.record(z.string().regex(/^[a-z][a-z0-9]*$/), OptionValue);

export const WidgetNode = z
  .strictObject({
    id: Identifier,
    class: WidgetClassName,
    options: Options.optional(),
    layout: Layout.optional(),
    placement: Placement.optional(),
    bindings: z.array(Binding).optional(),
    get children() {
      return z.array(WidgetNode).optional();
    },
  })
  .meta({ id: 'WidgetNode', description: 'ウィジェット' });

/** wm 系の設定 */
export const WindowSettings = z.strictObject({
  title: z.string().optional(),
  geometry: z
    .string()
    .regex(/^(?=.)(\d+x\d+)?([+-]\d+[+-]\d+)?$/, '"400x300" や "400x300+100+50" の形式で指定する')
    .optional(),
  resizable: z.tuple([z.boolean(), z.boolean()]).optional(),
  minsize: z.tuple([NonNegativeInt, NonNegativeInt]).optional(),
  maxsize: z.tuple([NonNegativeInt, NonNegativeInt]).optional(),
});

export const ROOT_CLASSES = ['tk.Tk', 'tk.Toplevel'] as const;

export const RootNode = z
  .strictObject({
    id: Identifier,
    class: z.enum(ROOT_CLASSES),
    window: WindowSettings.optional(),
    options: Options.optional(),
    layout: Layout.optional(),
    bindings: z.array(Binding).optional(),
    children: z.array(WidgetNode).optional(),
  })
  .meta({ id: 'RootNode', description: 'ウィンドウ（生成されるクラス1つに対応する）' });

export const TkuiDocument = z
  .strictObject({
    $schema: z.string().optional(),
    formatVersion: z.literal(FORMAT_VERSION),
    variables: z.record(Identifier, Variable).optional(),
    root: RootNode,
  })
  .meta({ title: 'tk-designer UI definition (*.tkui.json)' });

// ---------------------------------------------------------------------------
// 型
// ---------------------------------------------------------------------------

export type TkuiDocument = z.infer<typeof TkuiDocument>;
export type RootNode = z.infer<typeof RootNode>;
export type WidgetNode = z.infer<typeof WidgetNode>;
export type Layout = z.infer<typeof Layout>;
export type Placement = z.infer<typeof Placement>;
export type Binding = z.infer<typeof Binding>;
export type Variable = z.infer<typeof Variable>;
export type OptionValue = z.infer<typeof OptionValue>;
export type VariableRef = z.infer<typeof VariableRef>;
export type HandlerRef = z.infer<typeof HandlerRef>;
export type WindowSettings = z.infer<typeof WindowSettings>;
