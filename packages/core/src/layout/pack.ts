/**
 * pack ジオメトリマネージャ。Tk 8.6 の generic/tkPack.c（ArrangePacking, XExpansion, YExpansion）の移植。
 * 整数演算（C の int 除算の切り捨て）も含めて Tk に合わせる。
 */
import type { Anchor } from '../dsl/schema.ts';
import { anchorOffset, idiv } from './math.ts';
import type { Insets, Rect, Size } from './types.ts';

export interface PackItem {
  readonly req: Size;
  readonly side: 'top' | 'bottom' | 'left' | 'right';
  readonly fillX: boolean;
  readonly fillY: boolean;
  readonly expand: boolean;
  readonly anchor: Anchor;
  readonly padLeft: number;
  readonly padRight: number;
  readonly padTop: number;
  readonly padBottom: number;
  /** 内側の余白の合計（Tk の iPadX。-ipadx の2倍） */
  readonly iPadX: number;
  readonly iPadY: number;
}

const isVertical = (item: PackItem) => item.side === 'top' || item.side === 'bottom';
const padX = (item: PackItem) => item.padLeft + item.padRight;
const padY = (item: PackItem) => item.padTop + item.padBottom;

/** コンテナの要求サイズ（ArrangePacking の Pass #1） */
export function packRequest(items: readonly PackItem[], insets: Insets): Size {
  let width = insets.left + insets.right;
  let maxWidth = width;
  let height = insets.top + insets.bottom;
  let maxHeight = height;
  for (const item of items) {
    if (isVertical(item)) {
      maxWidth = Math.max(maxWidth, item.req.width + padX(item) + item.iPadX + width);
      height += item.req.height + padY(item) + item.iPadY;
    } else {
      maxHeight = Math.max(maxHeight, item.req.height + padY(item) + item.iPadY + height);
      width += item.req.width + padX(item) + item.iPadX;
    }
  }
  return { width: Math.max(width, maxWidth), height: Math.max(height, maxHeight) };
}

/** 各要素の配置（ArrangePacking の Pass #2）。大きさが 0 以下の要素は Tk では表示されない */
export function packArrange(items: readonly PackItem[], size: Size, insets: Insets): Rect[] {
  let cavityX = insets.left;
  let cavityY = insets.top;
  let cavityWidth = size.width - insets.left - insets.right;
  let cavityHeight = size.height - insets.top - insets.bottom;

  return items.map((item, index) => {
    let frameX: number;
    let frameY: number;
    let frameWidth: number;
    let frameHeight: number;

    if (isVertical(item)) {
      frameWidth = cavityWidth;
      frameHeight = item.req.height + padY(item) + item.iPadY;
      if (item.expand) frameHeight += yExpansion(items, index, cavityHeight);
      cavityHeight -= frameHeight;
      if (cavityHeight < 0) {
        frameHeight += cavityHeight;
        cavityHeight = 0;
      }
      frameX = cavityX;
      if (item.side === 'top') {
        frameY = cavityY;
        cavityY += frameHeight;
      } else {
        frameY = cavityY + cavityHeight;
      }
    } else {
      frameHeight = cavityHeight;
      frameWidth = item.req.width + padX(item) + item.iPadX;
      if (item.expand) frameWidth += xExpansion(items, index, cavityWidth);
      cavityWidth -= frameWidth;
      if (cavityWidth < 0) {
        frameWidth += cavityWidth;
        cavityWidth = 0;
      }
      frameY = cavityY;
      if (item.side === 'left') {
        frameX = cavityX;
        cavityX += frameWidth;
      } else {
        frameX = cavityX + cavityWidth;
      }
    }

    let width = item.req.width + item.iPadX;
    if (item.fillX || width > frameWidth - padX(item)) width = frameWidth - padX(item);
    let height = item.req.height + item.iPadY;
    if (item.fillY || height > frameHeight - padY(item)) height = frameHeight - padY(item);

    const { dx, dy } = anchorOffset(item.anchor, {
      spareX: frameWidth - width,
      spareY: frameHeight - height,
      left: item.padLeft,
      right: item.padRight,
      top: item.padTop,
      bottom: item.padBottom,
    });
    return { x: frameX + dx, y: frameY + dy, width, height };
  });
}

function xExpansion(items: readonly PackItem[], from: number, cavityWidth: number): number {
  let minExpand = cavityWidth;
  let numExpand = 0;
  for (const item of items.slice(from)) {
    const childWidth = item.req.width + padX(item) + item.iPadX;
    if (isVertical(item)) {
      if (numExpand) minExpand = Math.min(minExpand, idiv(cavityWidth - childWidth, numExpand));
    } else {
      cavityWidth -= childWidth;
      if (item.expand) numExpand++;
    }
  }
  if (numExpand) minExpand = Math.min(minExpand, idiv(cavityWidth, numExpand));
  return Math.max(minExpand, 0);
}

function yExpansion(items: readonly PackItem[], from: number, cavityHeight: number): number {
  let minExpand = cavityHeight;
  let numExpand = 0;
  for (const item of items.slice(from)) {
    const childHeight = item.req.height + padY(item) + item.iPadY;
    if (!isVertical(item)) {
      if (numExpand) minExpand = Math.min(minExpand, idiv(cavityHeight - childHeight, numExpand));
    } else {
      cavityHeight -= childHeight;
      if (item.expand) numExpand++;
    }
  }
  if (numExpand) minExpand = Math.min(minExpand, idiv(cavityHeight, numExpand));
  return Math.max(minExpand, 0);
}
