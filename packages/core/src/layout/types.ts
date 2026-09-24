import type { AnyNode } from '../edit/tree.ts';

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Rect extends Size {
  readonly x: number;
  readonly y: number;
}

/** コンテナの内側の余白（Tk の internal border。枠線・padding など） */
export interface Insets {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export const NO_INSETS: Insets = { left: 0, top: 0, right: 0, bottom: 0 };

/**
 * レイアウト計算に必要な、ウィジェット固有の寸法（docs/adr/0008）。
 * 文字幅の計測などは環境（DOM 等）に依存するため、呼び出し側が実装して渡す。
 * 値は整数（ピクセル）で返すこと。
 */
export interface LayoutMetrics {
  /**
   * 子の配置から大きさが決まらないときの要求サイズ。
   * 子を持たないウィジェット、または propagate が false のコンテナで使う。
   */
  naturalSize(node: AnyNode): Size;
  /** コンテナの内側の余白。Notebook ではタブの領域を含む */
  insets(node: AnyNode): Insets;
}

export interface LayoutBox {
  /** ルートウィンドウの内側の左上を原点とする位置と大きさ */
  readonly rect: Rect;
  /** Tk の要求サイズ（winfo reqwidth / reqheight） */
  readonly requested: Size;
  /** 表示されるか（大きさが 0 以下になった、または Notebook の選択されていないタブの中身なら false） */
  readonly mapped: boolean;
}

/** ウィジェット id → 配置結果 */
export type LayoutResult = ReadonlyMap<string, LayoutBox>;
