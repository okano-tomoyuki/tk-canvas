import { describe, expect, it } from 'vitest';
import type { TkuiDocument } from '../dsl/schema.ts';
import { computeLayout } from './engine.ts';
import { NO_INSETS, type LayoutMetrics } from './types.ts';

/** すべての葉を 40x20、Notebook のタブ領域を上 24 とする */
const metrics: LayoutMetrics = {
  naturalSize: () => ({ width: 40, height: 20 }),
  insets: (node) =>
    node.class === 'ttk.Notebook' ? { left: 2, top: 24, right: 2, bottom: 2 } : NO_INSETS,
};

function rectOf(layout: ReturnType<typeof computeLayout>, id: string) {
  const box = layout.get(id);
  return box && { ...box.rect, mapped: box.mapped };
}

describe('computeLayout', () => {
  it('geometry が無ければルートは要求サイズになる', () => {
    const doc: TkuiDocument = {
      formatVersion: 1,
      root: {
        id: 'root',
        class: 'tk.Tk',
        layout: { manager: 'pack' },
        children: [
          { id: 'a', class: 'ttk.Label', placement: { side: 'left' } },
          { id: 'b', class: 'ttk.Label', placement: { side: 'left', padx: 5 } },
        ],
      },
    };
    expect(rectOf(computeLayout(doc, metrics), 'root')).toEqual({
      x: 0,
      y: 0,
      width: 90,
      height: 20,
      mapped: true,
    });
  });

  it('Notebook は選択中のタブだけを表示し、ページはタブ領域の内側に広げる', () => {
    const doc: TkuiDocument = {
      formatVersion: 1,
      root: {
        id: 'root',
        class: 'tk.Tk',
        window: { geometry: '200x150' },
        layout: { manager: 'pack' },
        children: [
          {
            id: 'tabs',
            class: 'ttk.Notebook',
            placement: { fill: 'both', expand: true },
            children: [
              { id: 'page1', class: 'ttk.Frame', placement: { text: 'One' } },
              { id: 'page2', class: 'ttk.Frame', placement: { text: 'Two', padding: 5 } },
            ],
          },
        ],
      },
    };
    const first = computeLayout(doc, metrics);
    expect(rectOf(first, 'page1')).toEqual({ x: 2, y: 24, width: 196, height: 124, mapped: true });
    expect(rectOf(first, 'page2')?.mapped).toBe(false);

    const second = computeLayout(doc, metrics, { selectedTabs: new Map([['tabs', 'page2']]) });
    expect(rectOf(second, 'page2')).toEqual({ x: 7, y: 29, width: 186, height: 114, mapped: true });
  });

  it('PanedWindow は余りを weight に比例して配分する', () => {
    const doc: TkuiDocument = {
      formatVersion: 1,
      root: {
        id: 'root',
        class: 'tk.Tk',
        window: { geometry: '305x100' },
        layout: { manager: 'pack' },
        children: [
          {
            id: 'panes',
            class: 'ttk.PanedWindow',
            options: { orient: 'horizontal' },
            placement: { fill: 'both', expand: true },
            children: [
              { id: 'left', class: 'ttk.Frame', placement: { weight: 1 } },
              { id: 'right', class: 'ttk.Frame', placement: { weight: 2 } },
            ],
          },
        ],
      },
    };
    // 余り = 305 - (40 + 5 + 40) = 220 → 1:2 で 73 / 147
    const layout = computeLayout(doc, metrics);
    expect(rectOf(layout, 'left')).toEqual({ x: 0, y: 0, width: 113, height: 100, mapped: true });
    expect(rectOf(layout, 'right')).toEqual({
      x: 118,
      y: 0,
      width: 187,
      height: 100,
      mapped: true,
    });
  });
});
