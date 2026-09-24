/**
 * レイアウトエンジンを実際の Tk の配置結果と比較する（docs/adr/0008「検証方法」の 1.）。
 * 葉ウィジェットの要求サイズには Tk で記録した値を与え、配置アルゴリズムだけを検証する。
 */
import { describe, expect, it } from 'vitest';
import { parseDocument } from '../dsl/parse.ts';
import type { AnyNode } from '../edit/tree.ts';
import { computeLayout } from './engine.ts';
import { LAYOUT_FIXTURES, type TkRecord } from './fixtures/index.ts';
import { NO_INSETS, type Insets, type LayoutMetrics } from './types.ts';

function metricsFrom(tk: TkRecord): LayoutMetrics {
  return {
    naturalSize(node) {
      const [width = 0, height = 0] = tk.widgets[node.id]?.requested ?? [];
      return { width, height };
    },
    insets: frameInsets,
  };
}

/** tk.Frame の内側の余白は borderwidth + highlightthickness + padx / pady（tkFrame.c） */
function frameInsets(node: AnyNode): Insets {
  if (node.class !== 'tk.Frame') return NO_INSETS;
  const num = (name: string) => {
    const value = node.options?.[name];
    return typeof value === 'number' ? value : 0;
  };
  const border = num('borderwidth') + num('highlightthickness');
  const x = border + num('padx');
  const y = border + num('pady');
  return { left: x, right: x, top: y, bottom: y };
}

describe.each(LAYOUT_FIXTURES)('Tk との比較: $name', ({ document, tk }) => {
  const doc = parseDocument(JSON.stringify(document)).document;
  if (!doc) throw new Error('fixture is invalid');
  const layout = computeLayout(doc, metricsFrom(tk));

  it.each(Object.entries(tk.widgets))('%s', (id, expected) => {
    const box = layout.get(id);
    expect(box?.mapped).toBe(expected.mapped);
    if (!expected.mapped) return;
    expect(box && [box.requested.width, box.requested.height]).toEqual(expected.requested);
    expect(box && [box.rect.x, box.rect.y, box.rect.width, box.rect.height]).toEqual(expected.rect);
  });
});
