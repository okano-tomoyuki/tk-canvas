import type { Anchor } from '../dsl/schema.ts';

/** C の int 除算（0 方向への切り捨て） */
export function idiv(a: number, b: number): number {
  return Math.trunc(a / b);
}

/** C の (int)(x + (x > 0 ? 0.5 : -0.5))。Tk の place が使う四捨五入 */
export function roundHalfAway(x: number): number {
  return Math.trunc(x + (x > 0 ? 0.5 : -0.5));
}

/**
 * 枠（frame）の中での要素の位置を anchor から求める（tkPack.c の switch (anchor) と同じ計算）。
 * spare は枠の大きさ - 要素の大きさ、left/right/top/bottom は外側の余白。
 */
export function anchorOffset(
  anchor: Anchor,
  p: {
    readonly spareX: number;
    readonly spareY: number;
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
  },
): { dx: number; dy: number } {
  const centerX = idiv(p.left + p.spareX - p.right, 2);
  const centerY = idiv(p.top + p.spareY - p.bottom, 2);
  const east = p.spareX - p.right;
  const south = p.spareY - p.bottom;
  switch (anchor) {
    case 'n':
      return { dx: centerX, dy: p.top };
    case 'ne':
      return { dx: east, dy: p.top };
    case 'e':
      return { dx: east, dy: centerY };
    case 'se':
      return { dx: east, dy: south };
    case 's':
      return { dx: centerX, dy: south };
    case 'sw':
      return { dx: p.left, dy: south };
    case 'w':
      return { dx: p.left, dy: centerY };
    case 'nw':
      return { dx: p.left, dy: p.top };
    case 'center':
      return { dx: centerX, dy: centerY };
  }
}
