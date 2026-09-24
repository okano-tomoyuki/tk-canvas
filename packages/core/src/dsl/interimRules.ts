/**
 * ウィジェットごとの規則のうち、ウィジェットカタログ（docs/adr/0007）ができるまで暫定的にここで定義するもの。
 * カタログの導入時に、カタログからの参照へ置き換える。
 */
import type * as z from 'zod';
import {
  GridPlacement,
  NotebookTabPlacement,
  PackPlacement,
  PanePlacement,
  PlacePlacement,
  type GeometryManager,
  type RootNode,
  type VariableType,
  type WidgetNode,
} from './schema.ts';

/** 子の置き方の種類。ジオメトリマネージャ、またはウィジェット固有の追加方法 */
export type ContainerKind = GeometryManager | 'notebook' | 'paned';

/** layout を書かなくても、クラスによって子の置き方が決まるウィジェット */
const IMPLICIT_CONTAINERS: Readonly<Record<string, ContainerKind>> = {
  'ttk.Notebook': 'notebook',
  'ttk.PanedWindow': 'paned',
};

export function isImplicitContainer(className: string): boolean {
  return className in IMPLICIT_CONTAINERS;
}

/** このノードが子をどう置くか。子を持てない（layout がない）場合は undefined */
export function containerKindOf(node: RootNode | WidgetNode): ContainerKind | undefined {
  return IMPLICIT_CONTAINERS[node.class] ?? node.layout?.manager;
}

export const PLACEMENT_SCHEMAS: Readonly<Record<ContainerKind, z.ZodType>> = {
  pack: PackPlacement,
  grid: GridPlacement,
  place: PlacePlacement,
  notebook: NotebookTabPlacement,
  paned: PanePlacement,
};

/** 変数参照を受け付けるオプションと、受け付ける変数型 */
export const VARIABLE_OPTIONS: Readonly<Record<string, readonly VariableType[]>> = {
  textvariable: ['StringVar'],
  listvariable: ['StringVar'],
  variable: ['StringVar', 'IntVar', 'DoubleVar', 'BooleanVar'],
};

/** ハンドラ参照を受け付けるオプション */
export const HANDLER_OPTIONS: ReadonlySet<string> = new Set(['command']);

/**
 * ハンドラのシグネチャ。
 * - none: 引数なし（Button の command など）
 * - value: 現在値を1つ受け取る（Scale の command）
 * - event: イベントを1つ受け取る（bind）
 */
export type HandlerSignature = 'none' | 'value' | 'event';

const VALUE_COMMAND_CLASSES: ReadonlySet<string> = new Set(['tk.Scale', 'ttk.Scale']);

export function commandSignatureOf(className: string): HandlerSignature {
  return VALUE_COMMAND_CLASSES.has(className) ? 'value' : 'none';
}
