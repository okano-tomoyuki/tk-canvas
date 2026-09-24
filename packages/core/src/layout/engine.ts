/**
 * ドキュメント全体のレイアウトを計算する（docs/adr/0008）。
 *
 * 1. 下から上へ: 各ウィジェットの要求サイズを求める（葉は LayoutMetrics から、コンテナは子の配置から）
 * 2. 上から下へ: ルートの大きさを決め、各コンテナのジオメトリマネージャで子の位置と大きさを決める
 *
 * Tk はアイドル時に要求サイズの伝搬と再配置を繰り返して落ち着くが、ここではその落ち着いた状態を直接計算する。
 */
import type {
  GridPlacement,
  NotebookTabPlacement,
  PackPlacement,
  PanePlacement,
  PlacePlacement,
  TkuiDocument,
  WidgetNode,
} from '../dsl/schema.ts';
import { containerKindOf } from '../dsl/placement.ts';
import type { AnyNode } from '../edit/tree.ts';
import {
  gridArrange,
  gridBoundaries,
  gridRequest,
  type GridConfig,
  type GridItem,
  type GridLineConfig,
} from './grid.ts';
import { idiv } from './math.ts';
import { packArrange, packRequest, type PackItem } from './pack.ts';
import { placeArrange } from './place.ts';
import {
  NO_INSETS,
  type Insets,
  type LayoutBox,
  type LayoutMetrics,
  type LayoutResult,
  type Rect,
  type Size,
} from './types.ts';

export interface LayoutOptions {
  /** Notebook の id → 表示するタブ（子の id）。未指定なら最初のタブ */
  readonly selectedTabs?: ReadonlyMap<string, string>;
  /** PanedWindow の仕切りの太さ（既定 5） */
  readonly sashThickness?: number;
}

export function computeLayout(
  doc: TkuiDocument,
  metrics: LayoutMetrics,
  options: LayoutOptions = {},
): LayoutResult {
  return new LayoutEngine(metrics, options).run(doc);
}

class LayoutEngine {
  private readonly metrics: LayoutMetrics;
  private readonly options: LayoutOptions;
  private readonly requests = new Map<AnyNode, Size>();
  private readonly result = new Map<string, LayoutBox>();

  constructor(metrics: LayoutMetrics, options: LayoutOptions) {
    this.metrics = metrics;
    this.options = options;
  }

  run(doc: TkuiDocument): LayoutResult {
    const root = doc.root;
    const size = parseGeometrySize(root.window?.geometry) ?? this.request(root);
    this.arrange(root, { x: 0, y: 0, ...size }, true);
    return this.result;
  }

  // ---- 要求サイズ -----------------------------------------------------------

  private request(node: AnyNode): Size {
    const cached = this.requests.get(node);
    if (cached) return cached;
    const size = this.computeRequest(node);
    this.requests.set(node, size);
    return size;
  }

  private computeRequest(node: AnyNode): Size {
    const children = node.children ?? [];
    const kind = containerKindOf(node);
    const propagate = node.layout && 'propagate' in node.layout ? node.layout.propagate : undefined;
    if (!kind || children.length === 0 || propagate === false)
      return this.metrics.naturalSize(node);

    const insets = this.metrics.insets(node);
    switch (kind) {
      case 'pack':
        return packRequest(
          children.map((c) => this.packItem(c)),
          insets,
        );
      case 'grid':
        return gridRequest(this.gridItems(children), gridConfig(node), insets);
      case 'place':
        // place はコンテナの要求サイズに影響しない
        return this.metrics.naturalSize(node);
      case 'notebook': {
        const sizes = children.map((c) => this.request(c));
        return {
          width: Math.max(0, ...sizes.map((s) => s.width)) + insets.left + insets.right,
          height: Math.max(0, ...sizes.map((s) => s.height)) + insets.top + insets.bottom,
        };
      }
      case 'paned': {
        const horizontal = isHorizontal(node);
        const sizes = children.map((c) => this.request(c));
        const along =
          sizes.reduce((sum, s) => sum + (horizontal ? s.width : s.height), 0) +
          this.sash() * (children.length - 1);
        const across = Math.max(0, ...sizes.map((s) => (horizontal ? s.height : s.width)));
        return horizontal
          ? {
              width: along + insets.left + insets.right,
              height: across + insets.top + insets.bottom,
            }
          : {
              width: across + insets.left + insets.right,
              height: along + insets.top + insets.bottom,
            };
      }
    }
  }

  // ---- 配置 -----------------------------------------------------------------

  private arrange(node: AnyNode, rect: Rect, mapped: boolean): void {
    const children = node.children ?? [];
    const kind = containerKindOf(node);
    const size = { width: rect.width, height: rect.height };
    const insets = kind ? this.metrics.insets(node) : NO_INSETS;
    this.result.set(node.id, {
      rect,
      requested: this.request(node),
      mapped,
      ...(kind && {
        content: {
          x: rect.x + insets.left,
          y: rect.y + insets.top,
          width: Math.max(0, rect.width - insets.left - insets.right),
          height: Math.max(0, rect.height - insets.top - insets.bottom),
        },
      }),
      ...(kind === 'grid' && { grid: this.gridLines(node, children, rect, insets) }),
    });
    if (!kind || children.length === 0) return;

    const rects = this.arrangeChildren(node, kind, children, size, insets);
    const visible = this.visibleChildren(node, kind, children);

    children.forEach((child, i) => {
      const r = rects[i] ?? { x: 0, y: 0, width: 0, height: 0 };
      const childMapped = mapped && visible[i] === true && r.width > 0 && r.height > 0;
      this.arrange(child, { ...r, x: rect.x + r.x, y: rect.y + r.y }, childMapped);
    });
  }

  /** grid の行・列の境界（ルート基準の座標） */
  private gridLines(node: AnyNode, children: readonly WidgetNode[], rect: Rect, insets: Insets) {
    const lines = gridBoundaries(this.gridItems(children), gridConfig(node), rect, insets);
    return {
      columns: lines.columns.map((x) => rect.x + x),
      rows: lines.rows.map((y) => rect.y + y),
    };
  }

  private arrangeChildren(
    node: AnyNode,
    kind: NonNullable<ReturnType<typeof containerKindOf>>,
    children: readonly WidgetNode[],
    size: Size,
    insets: Insets,
  ): Rect[] {
    switch (kind) {
      case 'pack':
        return packArrange(
          children.map((c) => this.packItem(c)),
          size,
          insets,
        );
      case 'grid':
        return gridArrange(this.gridItems(children), gridConfig(node), size, insets);
      case 'place':
        return placeArrange(
          children.map((c) => ({
            req: this.request(c),
            placement: (c.placement ?? {}) as PlacePlacement,
          })),
          size,
          insets,
        );
      case 'notebook':
        return children.map((c) => this.notebookPage(c, size, insets));
      case 'paned':
        return this.panedArrange(node, children, size, insets);
    }
  }

  private visibleChildren(node: AnyNode, kind: string, children: readonly WidgetNode[]): boolean[] {
    if (kind !== 'notebook') return children.map(() => true);
    const selected = this.options.selectedTabs?.get(node.id) ?? children[0]?.id;
    return children.map((c) => c.id === selected);
  }

  // ---- 各マネージャへの入力 ---------------------------------------------------

  private packItem(child: WidgetNode): PackItem {
    const p = (child.placement ?? {}) as PackPlacement;
    const fill = p.fill ?? 'none';
    const [padLeft, padRight] = pad(p.padx);
    const [padTop, padBottom] = pad(p.pady);
    return {
      req: this.request(child),
      side: p.side ?? 'top',
      fillX: fill === 'x' || fill === 'both',
      fillY: fill === 'y' || fill === 'both',
      expand: p.expand ?? false,
      anchor: p.anchor ?? 'center',
      padLeft,
      padRight,
      padTop,
      padBottom,
      iPadX: Math.round(p.ipadx ?? 0) * 2,
      iPadY: Math.round(p.ipady ?? 0) * 2,
    };
  }

  private gridItems(children: readonly WidgetNode[]): GridItem[] {
    // 行を省略した要素は、それまでに置いた要素の最終行の次の行に置く（Tk と同じ）
    let rowEnd = 0;
    return children.map((child) => {
      const p = (child.placement ?? {}) as GridPlacement;
      const row = p.row ?? rowEnd;
      const rowspan = p.rowspan ?? 1;
      rowEnd = Math.max(rowEnd, row + rowspan);
      const sticky = p.sticky ?? '';
      const [padLeft, padRight] = pad(p.padx);
      const [padTop, padBottom] = pad(p.pady);
      return {
        req: this.request(child),
        row,
        column: p.column ?? 0,
        rowspan,
        columnspan: p.columnspan ?? 1,
        stickN: sticky.includes('n'),
        stickS: sticky.includes('s'),
        stickE: sticky.includes('e'),
        stickW: sticky.includes('w'),
        padLeft,
        padRight,
        padTop,
        padBottom,
        iPadX: Math.round(p.ipadx ?? 0) * 2,
        iPadY: Math.round(p.ipady ?? 0) * 2,
      };
    });
  }

  /** Notebook のページはタブ領域を除いた内側に置く（sticky の既定は nsew） */
  private notebookPage(child: WidgetNode, size: Size, insets: Insets): Rect {
    const p = (child.placement ?? {}) as NotebookTabPlacement;
    const [padLeft, padTop, padRight, padBottom] = tabPadding(p.padding);
    const sticky = p.sticky ?? 'nsew';
    const req = this.request(child);
    const cavity: Rect = {
      x: insets.left + padLeft,
      y: insets.top + padTop,
      width: size.width - insets.left - insets.right - padLeft - padRight,
      height: size.height - insets.top - insets.bottom - padTop - padBottom,
    };
    const stretchX = sticky.includes('e') && sticky.includes('w');
    const stretchY = sticky.includes('n') && sticky.includes('s');
    const width = stretchX ? cavity.width : Math.min(req.width, cavity.width);
    const height = stretchY ? cavity.height : Math.min(req.height, cavity.height);
    return {
      x: cavity.x + offsetFor(sticky, 'w', 'e', cavity.width - width),
      y: cavity.y + offsetFor(sticky, 'n', 's', cavity.height - height),
      width,
      height,
    };
  }

  /**
   * PanedWindow のペイン。要求サイズを並べ、余り（不足）を weight に比例して配分する。
   * 重みがすべて 0 のときは最後のペインで吸収する（Tk の ttk::panedwindow の近似）。
   */
  private panedArrange(
    node: AnyNode,
    children: readonly WidgetNode[],
    size: Size,
    insets: Insets,
  ): Rect[] {
    const horizontal = isHorizontal(node);
    const along = (s: Size) => (horizontal ? s.width : s.height);
    const inner = {
      width: size.width - insets.left - insets.right,
      height: size.height - insets.top - insets.bottom,
    };
    const sizes = children.map((c) => along(this.request(c)));
    const weights = children.map((c) => ((c.placement ?? {}) as PanePlacement).weight ?? 0);
    const total = sizes.reduce((a, b) => a + b, 0) + this.sash() * (children.length - 1);
    const extra = along(inner) - total;
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    if (totalWeight > 0) {
      let acc = 0;
      let given = 0;
      weights.forEach((w, i) => {
        acc += w;
        const share = idiv(extra * acc, totalWeight) - given;
        given += share;
        sizes[i] = Math.max(0, (sizes[i] ?? 0) + share);
      });
    } else if (sizes.length > 0) {
      const last = sizes.length - 1;
      sizes[last] = Math.max(0, (sizes[last] ?? 0) + extra);
    }

    let position = horizontal ? insets.left : insets.top;
    return sizes.map((s) => {
      const rect = horizontal
        ? { x: position, y: insets.top, width: s, height: inner.height }
        : { x: insets.left, y: position, width: inner.width, height: s };
      position += s + this.sash();
      return rect;
    });
  }

  private sash(): number {
    return this.options.sashThickness ?? 5;
  }
}

// ---- 補助 ---------------------------------------------------------------------

/** "400x300" や "400x300+10+20" から大きさを取り出す */
function parseGeometrySize(geometry: string | undefined): Size | undefined {
  const match = geometry ? /^(\d+)x(\d+)/.exec(geometry) : null;
  return match ? { width: Number(match[1]), height: Number(match[2]) } : undefined;
}

function gridConfig(node: AnyNode): GridConfig {
  const layout = node.layout?.manager === 'grid' ? node.layout : undefined;
  const lines = (
    record:
      | Record<string, { weight?: number; minsize?: number; pad?: number; uniform?: string }>
      | undefined,
  ) =>
    new Map<number, GridLineConfig>(
      Object.entries(record ?? {}).map(([index, c]) => [
        Number(index),
        {
          weight: c.weight ?? 0,
          minsize: c.minsize ?? 0,
          pad: c.pad ?? 0,
          uniform: c.uniform || undefined,
        },
      ]),
    );
  return { columns: lines(layout?.columns), rows: lines(layout?.rows) };
}

/** -padx / -pady: 1値なら両側同じ、2値なら [前, 後] */
function pad(value: number | readonly [number, number] | undefined): [number, number] {
  if (value === undefined) return [0, 0];
  if (typeof value === 'number') return [Math.round(value), Math.round(value)];
  return [Math.round(value[0]), Math.round(value[1])];
}

/** Notebook のタブの -padding: 1値・2値（横, 縦）・4値（左, 上, 右, 下） */
function tabPadding(value: NotebookTabPlacement['padding']): [number, number, number, number] {
  if (value === undefined) return [0, 0, 0, 0];
  if (typeof value === 'number') return [value, value, value, value];
  if (value.length === 2) return [value[0], value[1], value[0], value[1]];
  return [value[0], value[1], value[2], value[3]];
}

function offsetFor(sticky: string, start: string, end: string, spare: number): number {
  if (sticky.includes(start)) return 0;
  return sticky.includes(end) ? spare : idiv(spare, 2);
}

function isHorizontal(node: AnyNode): boolean {
  // ttk::panedwindow の -orient の既定は vertical
  return node.options?.orient === 'horizontal';
}
