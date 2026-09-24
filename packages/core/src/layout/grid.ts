/**
 * grid ジオメトリマネージャ。Tk 8.6 の generic/tkGrid.c（ResolveConstraints, AdjustOffsets, AdjustForSticky, ArrangeGrid）の移植。
 * 整数演算（C の int 除算の切り捨て）も含めて Tk に合わせる。grid の anchor は既定の nw のみ扱う。
 */
import { idiv } from './math.ts';
import type { Insets, Rect, Size } from './types.ts';

export interface GridItem {
  readonly req: Size;
  readonly row: number;
  readonly column: number;
  readonly rowspan: number;
  readonly columnspan: number;
  readonly stickN: boolean;
  readonly stickS: boolean;
  readonly stickE: boolean;
  readonly stickW: boolean;
  readonly padLeft: number;
  readonly padRight: number;
  readonly padTop: number;
  readonly padBottom: number;
  /** 内側の余白の合計（Tk の iPadX。-ipadx の2倍） */
  readonly iPadX: number;
  readonly iPadY: number;
}

/** grid_columnconfigure / grid_rowconfigure の設定 */
export interface GridLineConfig {
  readonly weight: number;
  readonly minsize: number;
  readonly pad: number;
  readonly uniform: string | undefined;
}

export interface GridConfig {
  readonly columns: ReadonlyMap<number, GridLineConfig>;
  readonly rows: ReadonlyMap<number, GridLineConfig>;
}

type Axis = 'column' | 'row';

interface AxisItem {
  readonly start: number;
  readonly span: number;
  /** 要求サイズ + 外側・内側の余白 */
  readonly size: number;
}

const EMPTY_LINE: GridLineConfig = { weight: 0, minsize: 0, pad: 0, uniform: undefined };

function axisItems(items: readonly GridItem[], axis: Axis): AxisItem[] {
  return items.map((item) =>
    axis === 'column'
      ? {
          start: item.column,
          span: item.columnspan,
          size: item.req.width + item.padLeft + item.padRight + item.iPadX,
        }
      : {
          start: item.row,
          span: item.rowspan,
          size: item.req.height + item.padTop + item.padBottom + item.iPadY,
        },
  );
}

/** Tk の MAX(columnEnd, columnMax): 使われている位置と設定された位置のうち大きいほう */
function slotCount(items: readonly AxisItem[], lines: ReadonlyMap<number, GridLineConfig>): number {
  const used = Math.max(0, ...items.map((i) => i.start + i.span));
  const configured = Math.max(0, ...[...lines.keys()].map((k) => k + 1));
  return Math.max(used, configured);
}

interface Resolved {
  /** 全要素を要求サイズで収めるのに必要な大きさ */
  readonly requiredSize: number;
  /** 各スロットの右端（下端）の位置 */
  readonly offsets: number[];
}

/** ResolveConstraints の移植（maxOffset = 0 で呼ばれる場合のみ） */
function resolveConstraints(
  items: readonly AxisItem[],
  lines: ReadonlyMap<number, GridLineConfig>,
  gridCount: number,
): Resolved {
  // L[0] は 0 番目のスロットの左端を表すダミー。スロット s は L[s + 1]
  const L = Array.from({ length: gridCount + 1 }, (_, i) => {
    const line = i === 0 ? EMPTY_LINE : (lines.get(i - 1) ?? EMPTY_LINE);
    return {
      minSize: line.minsize,
      weight: line.weight,
      uniform: line.uniform,
      pad: line.pad,
      minOffset: 0,
      maxOffset: 0,
      bin: [] as AxisItem[],
    };
  });
  const at = (slot: number) => {
    const entry = L[slot + 1];
    if (!entry) throw new Error(`grid: slot ${String(slot)} is out of range`);
    return entry;
  };

  // Step 2: 1スロットだけを占める要素でスロットの最小サイズを決め、複数スロットにまたがる要素は右端のスロットに振り分ける
  for (const item of items) {
    const rightEdge = item.start + item.span - 1;
    if (item.span > 1) {
      at(rightEdge).bin.push(item);
    } else if (rightEdge >= 0) {
      const slot = at(rightEdge);
      slot.minSize = Math.max(slot.minSize, item.size + slot.pad);
    }
  }
  // Tk は単方向リストの先頭に積むため、振り分けた要素は後に追加したものから処理される
  for (const entry of L) entry.bin.reverse();

  // Step 2b: uniform グループ
  const groupMin = new Map<string, number>();
  for (let slot = 0; slot < gridCount; slot++) {
    const s = at(slot);
    if (s.uniform === undefined) continue;
    const weight = s.weight > 0 ? s.weight : 1;
    const minSize = idiv(s.minSize + weight - 1, weight);
    groupMin.set(s.uniform, Math.max(groupMin.get(s.uniform) ?? 0, minSize));
  }
  for (let slot = 0; slot < gridCount; slot++) {
    const s = at(slot);
    if (s.uniform === undefined) continue;
    const weight = s.weight > 0 ? s.weight : 1;
    s.minSize = (groupMin.get(s.uniform) ?? 0) * weight;
  }

  // Step 3: 左から右へ、各スロットの右端の最小位置を求める
  let offset = 0;
  for (let slot = 0; slot < gridCount; slot++) {
    const s = at(slot);
    s.minOffset = s.minSize + offset;
    for (const item of s.bin) {
      s.minOffset = Math.max(s.minOffset, item.size + at(slot - item.span).minOffset);
    }
    offset = s.minOffset;
  }
  const requiredSize = offset;

  // Step 4: 右から左へ、各スロットの右端の最大位置を求める
  for (let slot = 0; slot < gridCount; slot++) at(slot).maxOffset = offset;
  for (let slot = gridCount - 1; slot > 0;) {
    for (const item of at(slot).bin) {
      const require = offset - item.size;
      const startSlot = slot - item.span;
      if (startSlot >= 0 && require < at(startSlot).maxOffset) at(startSlot).maxOffset = require;
    }
    offset -= at(slot).minSize;
    slot--;
    if (at(slot).maxOffset < offset) {
      offset = at(slot).maxOffset;
    } else {
      at(slot).maxOffset = offset;
    }
  }

  // Step 5: 位置の決まっていない範囲に、重みに従って余りを配分する
  for (let start = 0; start < gridCount;) {
    if (at(start).minOffset === at(start).maxOffset) {
      start++;
      continue;
    }
    let end = start + 1;
    while (end < gridCount && at(end).minOffset !== at(end).maxOffset) end++;

    let totalWeight = 0;
    let need = 0;
    for (let slot = start; slot <= end; slot++) {
      totalWeight += at(slot).weight;
      need += at(slot).minSize;
    }
    let have = at(end).maxOffset - at(start - 1).minOffset;
    const noWeights = totalWeight === 0;
    if (noWeights) totalWeight = end - start + 1;
    const weightOf = (slot: number) => (noWeights ? 1 : at(slot).weight);

    // 内部の境界の制約を破らない範囲まで have を減らす
    for (;;) {
      let prevMinOffset = at(start - 1).minOffset;
      let prevGrow = 0;
      let accWeight = 0;
      let fits = true;
      for (let slot = start; slot <= end; slot++) {
        const weight = weightOf(slot);
        accWeight += weight;
        let grow = idiv((have - need) * accWeight, totalWeight) - prevGrow;
        prevGrow += grow;
        if (weight > 0 && prevMinOffset + at(slot).minSize + grow > at(slot).maxOffset) {
          grow = at(slot).maxOffset - at(slot).minSize - prevMinOffset;
          let newHave = idiv(grow * totalWeight, weight);
          if (newHave > totalWeight) newHave = idiv(newHave, totalWeight) * totalWeight;
          if (newHave <= 0) {
            newHave = have - need - 1;
            if (newHave > 3 * totalWeight) newHave = idiv(newHave * 3, 4);
            if (newHave > totalWeight) newHave = idiv(newHave, totalWeight) * totalWeight;
            if (newHave <= 0) newHave = 1;
          }
          have = newHave + need;
          fits = false;
          break;
        }
        prevMinOffset = Math.max(prevMinOffset + at(slot).minSize + grow, at(slot).minOffset);
      }
      if (fits) break;
    }

    let prevGrow = 0;
    let accWeight = 0;
    for (let slot = start; slot <= end; slot++) {
      accWeight += weightOf(slot);
      const grow = idiv((have - need) * accWeight, totalWeight) - prevGrow;
      prevGrow += grow;
      const s = at(slot);
      s.minSize += grow;
      s.minOffset = Math.max(s.minOffset, at(slot - 1).minOffset + s.minSize);
    }
    for (let slot = end; slot > start; slot--) {
      const s = at(slot);
      at(slot - 1).maxOffset = Math.min(at(slot - 1).maxOffset, s.maxOffset - s.minSize);
    }
  }

  return {
    requiredSize,
    offsets: Array.from({ length: gridCount }, (_, slot) => at(slot).minOffset),
  };
}

/** AdjustOffsets の移植。実際の大きさに合わせて、重みに従ってスロットを伸縮する */
function adjustOffsets(
  size: number,
  offsets: number[],
  lines: ReadonlyMap<number, GridLineConfig>,
): number {
  const slots = offsets.length;
  const weightOf = (slot: number) => lines.get(slot)?.weight ?? 0;
  const minSizeOf = (slot: number) => lines.get(slot)?.minsize ?? 0;
  const current = (slot: number) =>
    (offsets[slot] ?? 0) - (slot === 0 ? 0 : (offsets[slot - 1] ?? 0));

  let diff = size - (offsets[slots - 1] ?? 0);
  if (diff === 0) return size;

  let totalWeight = 0;
  for (let slot = 0; slot < slots; slot++) totalWeight += weightOf(slot);
  if (totalWeight === 0) return offsets[slots - 1] ?? 0;

  if (diff > 0) {
    let weight = 0;
    for (let slot = 0; slot < slots; slot++) {
      weight += weightOf(slot);
      offsets[slot] = (offsets[slot] ?? 0) + idiv(diff * weight, totalWeight);
    }
    return size;
  }

  // 縮める: 重みのあるスロットは minsize まで、重みのないスロットは現在の大きさを保つ
  const floor = Array.from({ length: slots }, (_, slot) =>
    weightOf(slot) > 0 ? minSizeOf(slot) : current(slot),
  );
  const minSize = floor.reduce((a, b) => a + b, 0);
  if (size <= minSize) {
    let offset = 0;
    for (let slot = 0; slot < slots; slot++) {
      offset += floor[slot] ?? 0;
      offsets[slot] = offset;
    }
    return minSize;
  }

  while (diff < 0) {
    const temp = Array.from({ length: slots }, (_, slot) =>
      current(slot) > minSizeOf(slot) ? weightOf(slot) : 0,
    );
    totalWeight = temp.reduce((a, b) => a + b, 0);
    if (totalWeight === 0) break;

    let newDiff = diff;
    for (let slot = 0; slot < slots; slot++) {
      const t = temp[slot] ?? 0;
      if (t === 0) continue;
      const maxDiff = idiv(totalWeight * (minSizeOf(slot) - current(slot)), t);
      if (maxDiff > newDiff) newDiff = maxDiff;
    }

    let weight = 0;
    for (let slot = 0; slot < slots; slot++) {
      weight += temp[slot] ?? 0;
      offsets[slot] = (offsets[slot] ?? 0) + idiv(newDiff * weight, totalWeight);
    }
    diff -= newDiff;
  }
  return size;
}

/** コンテナの要求サイズ */
export function gridRequest(items: readonly GridItem[], config: GridConfig, insets: Insets): Size {
  const width = requiredSize(axisItems(items, 'column'), config.columns);
  const height = requiredSize(axisItems(items, 'row'), config.rows);
  return {
    width: width + insets.left + insets.right,
    height: height + insets.top + insets.bottom,
  };
}

function requiredSize(
  items: readonly AxisItem[],
  lines: ReadonlyMap<number, GridLineConfig>,
): number {
  return resolveConstraints(items, lines, slotCount(items, lines)).requiredSize;
}

/** 各要素の配置 */
export function gridArrange(
  items: readonly GridItem[],
  config: GridConfig,
  size: Size,
  insets: Insets,
): Rect[] {
  const columns = axisOffsets(
    axisItems(items, 'column'),
    config.columns,
    size.width - insets.left - insets.right,
  );
  const rows = axisOffsets(
    axisItems(items, 'row'),
    config.rows,
    size.height - insets.top - insets.bottom,
  );

  return items.map((item) => {
    const x0 = item.column > 0 ? (columns[item.column - 1] ?? 0) : 0;
    const y0 = item.row > 0 ? (rows[item.row - 1] ?? 0) : 0;
    const cavity = {
      x: x0 + insets.left,
      y: y0 + insets.top,
      width: (columns[item.column + item.columnspan - 1] ?? 0) - x0,
      height: (rows[item.row + item.rowspan - 1] ?? 0) - y0,
    };
    return adjustForSticky(item, cavity);
  });
}

function axisOffsets(
  items: readonly AxisItem[],
  lines: ReadonlyMap<number, GridLineConfig>,
  realSize: number,
): number[] {
  const { offsets } = resolveConstraints(items, lines, slotCount(items, lines));
  adjustOffsets(realSize, offsets, lines);
  return offsets;
}

/** AdjustForSticky の移植 */
function adjustForSticky(item: GridItem, cavity: Rect): Rect {
  let x = cavity.x + item.padLeft;
  let y = cavity.y + item.padTop;
  let width = cavity.width - item.padLeft - item.padRight;
  let height = cavity.height - item.padTop - item.padBottom;
  let diffX = 0;
  let diffY = 0;

  const reqWidth = item.req.width + item.iPadX;
  if (width > reqWidth) {
    diffX = width - reqWidth;
    width = reqWidth;
  }
  const reqHeight = item.req.height + item.iPadY;
  if (height > reqHeight) {
    diffY = height - reqHeight;
    height = reqHeight;
  }
  if (item.stickE && item.stickW) width += diffX;
  if (item.stickN && item.stickS) height += diffY;
  if (!item.stickW) x += item.stickE ? diffX : idiv(diffX, 2);
  if (!item.stickN) y += item.stickS ? diffY : idiv(diffY, 2);
  return { x, y, width, height };
}
