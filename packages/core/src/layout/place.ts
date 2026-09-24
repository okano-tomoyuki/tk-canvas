/**
 * place ジオメトリマネージャ。Tk 8.6 の generic/tkPlace.c（RecomputePlacement）の移植。
 * place はコンテナの要求サイズに影響しない。
 */
import type { PlacePlacement } from '../dsl/schema.ts';
import { idiv, roundHalfAway } from './math.ts';
import type { Insets, Rect, Size } from './types.ts';

export interface PlaceItem {
  readonly req: Size;
  readonly placement: PlacePlacement;
}

export function placeArrange(items: readonly PlaceItem[], size: Size, insets: Insets): Rect[] {
  return items.map(({ req, placement: p }) => {
    let containerX = 0;
    let containerY = 0;
    let containerWidth = size.width;
    let containerHeight = size.height;
    // outside は枠線（X のボーダー）の外側を基準にするが、Tk のウィジェットでは通常 0 のため inside 以外は同じ扱いにする
    if ((p.bordermode ?? 'inside') === 'inside') {
      containerX = insets.left;
      containerY = insets.top;
      containerWidth -= insets.left + insets.right;
      containerHeight -= insets.top + insets.bottom;
    }

    // -x / -width などは Tk では整数のピクセルに丸められる
    const x1 = Math.round(p.x ?? 0) + containerX + (p.relx ?? 0) * containerWidth;
    let x = roundHalfAway(x1);
    const y1 = Math.round(p.y ?? 0) + containerY + (p.rely ?? 0) * containerHeight;
    let y = roundHalfAway(y1);

    let width = req.width;
    if (p.width !== undefined || p.relwidth !== undefined) {
      width = Math.round(p.width ?? 0);
      if (p.relwidth !== undefined) width += roundHalfAway(x1 + p.relwidth * containerWidth) - x;
    }
    let height = req.height;
    if (p.height !== undefined || p.relheight !== undefined) {
      height = Math.round(p.height ?? 0);
      if (p.relheight !== undefined)
        height += roundHalfAway(y1 + p.relheight * containerHeight) - y;
    }

    switch (p.anchor ?? 'nw') {
      case 'n':
        x -= idiv(width, 2);
        break;
      case 'ne':
        x -= width;
        break;
      case 'e':
        x -= width;
        y -= idiv(height, 2);
        break;
      case 'se':
        x -= width;
        y -= height;
        break;
      case 's':
        x -= idiv(width, 2);
        y -= height;
        break;
      case 'sw':
        y -= height;
        break;
      case 'w':
        y -= idiv(height, 2);
        break;
      case 'nw':
        break;
      case 'center':
        x -= idiv(width, 2);
        y -= idiv(height, 2);
        break;
    }
    return { x, y, width, height };
  });
}
