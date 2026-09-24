/**
 * キャンバス上のドロップ位置から、追加・移動先（親・順番・placement）を決める。
 * ウィジェットの追加（パレットからのドラッグ）と移動（キャンバス上のドラッグ）で共通に使う。
 */
import { getWidgetCatalog } from '../catalog/catalog.ts';
import { containerKindOf, type ContainerKind } from '../dsl/placement.ts';
import type { GridPlacement, PackPlacement, Placement, TkuiDocument } from '../dsl/schema.ts';
import { isDescendantOrSelf, walkNodes, type AnyNode } from '../edit/tree.ts';
import type { LayoutResult, Rect } from './types.ts';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface DropTarget {
  readonly parentId: string;
  readonly kind: ContainerKind;
  /** 親の children 内での位置（移動の場合は、移動するウィジェットを除いた並びでの位置） */
  readonly index: number;
  /** 指定する placement。undefined なら追加時の初期値（移動時は現在の値）のまま */
  readonly placement: Placement | undefined;
  /** ドラッグ中に強調表示する範囲（ルート基準の座標） */
  readonly indicator: Rect;
}

/** 行・列の外側にドロップしたときに表示する帯の太さ */
const EDGE = 8;

/**
 * point（ルートウィンドウの内側の左上が原点）にドロップしたときの追加・移動先を返す。
 * @param moving 移動するウィジェットの id（自分自身や子孫の中には移動できない）
 */
export function findDropTarget(
  doc: TkuiDocument,
  layout: LayoutResult,
  point: Point,
  moving?: string,
): DropTarget | undefined {
  const movingNode = moving ? [...walkNodes(doc)].find((n) => n.id === moving) : undefined;

  // 最も内側（後から描かれる）のコンテナを選ぶ
  let container: AnyNode | undefined;
  for (const node of walkNodes(doc)) {
    const box = layout.get(node.id);
    if (!box?.mapped || !box.content || !contains(box.rect, point)) continue;
    if (!containerKindOf(node) || !getWidgetCatalog().classes.get(node.class)?.children) continue;
    if (movingNode && isDescendantOrSelf(movingNode, node)) continue;
    container = node;
  }
  if (!container) return undefined;
  const kind = containerKindOf(container);
  const box = layout.get(container.id);
  if (!kind || !box?.content) return undefined;

  const siblings = (container.children ?? []).filter((c) => c.id !== moving);
  const base = { parentId: container.id, kind };

  switch (kind) {
    case 'grid': {
      const { row, column, indicator } = gridCell(box.grid, box.content, point);
      return {
        ...base,
        index: siblings.length,
        placement: { ...(gridPlacementOf(movingNode) ?? {}), row, column },
        indicator,
      };
    }
    case 'pack': {
      const index = siblings.filter((c) =>
        isBefore(layout.get(c.id)?.rect, c.placement, point),
      ).length;
      return {
        ...base,
        index,
        placement: undefined,
        indicator: packIndicator(layout, siblings, index, box.content),
      };
    }
    case 'place': {
      const x = Math.round(point.x - box.content.x);
      const y = Math.round(point.y - box.content.y);
      return {
        ...base,
        index: siblings.length,
        placement: { x, y },
        indicator: { x: point.x - 4, y: point.y - 4, width: 8, height: 8 },
      };
    }
    case 'notebook':
    case 'paned':
      return { ...base, index: siblings.length, placement: undefined, indicator: box.content };
  }
}

function contains(rect: Rect, p: Point): boolean {
  return p.x >= rect.x && p.x < rect.x + rect.width && p.y >= rect.y && p.y < rect.y + rect.height;
}

/** grid のどのセルか。既存の行・列の外側なら、新しい行・列（末尾の次）とする */
function gridCell(
  grid: { readonly columns: readonly number[]; readonly rows: readonly number[] } | undefined,
  content: Rect,
  p: Point,
): { row: number; column: number; indicator: Rect } {
  const columns = grid?.columns ?? [content.x];
  const rows = grid?.rows ?? [content.y];
  const [column, x0, x1] = locate(columns, p.x);
  const [row, y0, y1] = locate(rows, p.y);
  return { row, column, indicator: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } };
}

/** 境界の列 bounds のどこに v があるか。[番号, 始点, 終点] */
function locate(bounds: readonly number[], v: number): [number, number, number] {
  for (let i = 0; i + 1 < bounds.length; i++) {
    const start = bounds[i] ?? 0;
    const end = bounds[i + 1] ?? start;
    if (v < end) return [i, start, end];
  }
  const last = bounds[bounds.length - 1] ?? 0;
  return [Math.max(0, bounds.length - 1), last, last + EDGE];
}

/** grid への移動で引き継ぐ placement の項目（row / column はドロップ位置で決める） */
const GRID_CARRY_OVER: ReadonlySet<string> = new Set([
  'rowspan',
  'columnspan',
  'sticky',
  'padx',
  'pady',
  'ipadx',
  'ipady',
]);

function gridPlacementOf(node: AnyNode | undefined): GridPlacement | undefined {
  // sticky や余白などの指定は引き継ぐ（pack の side など grid にない項目は捨てる）
  if (!node || !('placement' in node)) return undefined;
  return Object.fromEntries(
    Object.entries(node.placement ?? {}).filter(([key]) => GRID_CARRY_OVER.has(key)),
  );
}

/** pack で、ドロップ位置が兄弟 sibling より前（上・左）か。兄弟の side に応じて縦・横で比べる */
function isBefore(rect: Rect | undefined, placement: Placement | undefined, p: Point): boolean {
  if (!rect) return false;
  const side = (placement as PackPlacement | undefined)?.side ?? 'top';
  switch (side) {
    case 'top':
      return p.y >= rect.y + rect.height / 2;
    case 'bottom':
      return p.y <= rect.y + rect.height / 2;
    case 'left':
      return p.x >= rect.x + rect.width / 2;
    case 'right':
      return p.x <= rect.x + rect.width / 2;
  }
}

/** pack の挿入位置を示す線。index 番目の兄弟の手前（なければ最後の兄弟の後ろ）。左右に並ぶ兄弟なら縦線 */
function packIndicator(
  layout: LayoutResult,
  siblings: readonly AnyNode[],
  index: number,
  content: Rect,
): Rect {
  const line = (node: AnyNode | undefined, after: boolean): Rect | undefined => {
    const rect = node && layout.get(node.id)?.rect;
    if (!node || !rect) return undefined;
    const side =
      (('placement' in node ? node.placement : undefined) as PackPlacement | undefined)?.side ??
      'top';
    // 前後は pack の方向で決まる（bottom / right は逆向きに積まれる）
    const end = after !== (side === 'bottom' || side === 'right');
    if (side === 'left' || side === 'right') {
      return {
        x: end ? rect.x + rect.width - 1 : rect.x - 1,
        y: rect.y,
        width: 2,
        height: rect.height,
      };
    }
    return {
      x: rect.x,
      y: end ? rect.y + rect.height - 1 : rect.y - 1,
      width: rect.width,
      height: 2,
    };
  };
  return (
    line(siblings[index], false) ??
    line(siblings[index - 1], true) ?? {
      x: content.x,
      y: content.y,
      width: content.width,
      height: 2,
    }
  );
}
