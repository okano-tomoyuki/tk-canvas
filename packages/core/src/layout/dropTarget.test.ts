import { describe, expect, it } from 'vitest';
import type { TkuiDocument } from '../dsl/schema.ts';
import { findDropTarget } from './dropTarget.ts';
import { computeLayout } from './engine.ts';
import { NO_INSETS, type LayoutMetrics } from './types.ts';

/** 葉はすべて 40x20、空のコンテナは width / height オプション */
const metrics: LayoutMetrics = {
  naturalSize: (node) => {
    const w = node.options?.width;
    const h = node.options?.height;
    return node.class.endsWith('Frame')
      ? { width: typeof w === 'number' ? w : 0, height: typeof h === 'number' ? h : 0 }
      : { width: 40, height: 20 };
  },
  insets: () => NO_INSETS,
};

// 300x200 のウィンドウ。上に grid の Frame（2列 x 2行）、下に pack の Frame と place の Frame
const DOC: TkuiDocument = {
  formatVersion: 1,
  root: {
    id: 'root',
    class: 'tk.Tk',
    window: { geometry: '300x200' },
    layout: { manager: 'pack' },
    children: [
      {
        id: 'form',
        class: 'ttk.Frame',
        layout: { manager: 'grid' },
        placement: { fill: 'x' },
        children: [
          { id: 'a', class: 'ttk.Label', placement: { row: 0, column: 0 } },
          { id: 'b', class: 'ttk.Label', placement: { row: 0, column: 1, sticky: 'ew' } },
          { id: 'c', class: 'ttk.Label', placement: { row: 1, column: 0 } },
        ],
      },
      {
        id: 'bar',
        class: 'ttk.Frame',
        layout: { manager: 'pack' },
        placement: { fill: 'x' },
        children: [
          { id: 'p1', class: 'ttk.Button', placement: { side: 'left' } },
          { id: 'p2', class: 'ttk.Button', placement: { side: 'left' } },
        ],
      },
      {
        id: 'free',
        class: 'ttk.Frame',
        options: { width: 300, height: 100 },
        layout: { manager: 'place' },
        placement: { fill: 'both', expand: true },
      },
    ],
  },
};

const layout = computeLayout(DOC, metrics);

describe('findDropTarget', () => {
  it('grid: 指したセル', () => {
    // form は y=0..40。列の境界は 0 / 40 / 80（各 40px）、行は 0 / 20 / 40
    expect(findDropTarget(DOC, layout, { x: 50, y: 25 })).toMatchObject({
      parentId: 'form',
      kind: 'grid',
      index: 3,
      placement: { row: 1, column: 1 },
      indicator: { x: 40, y: 20, width: 40, height: 20 },
    });
  });

  it('grid: 既存の列の外側は新しい列', () => {
    expect(findDropTarget(DOC, layout, { x: 200, y: 5 })?.placement).toEqual({ row: 0, column: 2 });
  });

  it('grid: 移動では sticky などを引き継ぎ、自分を除いた位置にする', () => {
    expect(findDropTarget(DOC, layout, { x: 10, y: 25 }, 'b')).toMatchObject({
      index: 2,
      placement: { sticky: 'ew', row: 1, column: 0 },
    });
  });

  it('grid への移動では、grid にない項目（pack の side など）は捨てる', () => {
    expect(findDropTarget(DOC, layout, { x: 50, y: 25 }, 'p1')?.placement).toEqual({
      row: 1,
      column: 1,
    });
  });

  it('pack: 左右に並ぶ兄弟の間', () => {
    // bar は y=40..60、p1 は x=0..40、p2 は x=40..80
    const target = findDropTarget(DOC, layout, { x: 30, y: 50 });
    expect(target).toMatchObject({ parentId: 'bar', kind: 'pack', index: 1, placement: undefined });
    expect(target?.indicator).toMatchObject({ x: 39, width: 2 });
  });

  it('place: 指した座標', () => {
    // free は y=60..200
    expect(findDropTarget(DOC, layout, { x: 120, y: 90 })).toMatchObject({
      parentId: 'free',
      placement: { x: 120, y: 30 },
    });
  });

  it('自分自身の中へは移動できない（外側のコンテナになる）', () => {
    expect(findDropTarget(DOC, layout, { x: 10, y: 5 }, 'form')?.parentId).toBe('root');
  });
});
