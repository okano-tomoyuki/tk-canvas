import { describe, expect, it } from 'vitest';
import type { TkuiDocument } from '../dsl/schema.ts';
import { jsonPathOf, pathTo } from './tree.ts';

const DOC: TkuiDocument = {
  formatVersion: 1,
  root: {
    id: 'root',
    class: 'tk.Tk',
    layout: { manager: 'pack' },
    children: [
      {
        id: 'tabs',
        class: 'ttk.Notebook',
        children: [
          { id: 'page1', class: 'ttk.Frame', layout: { manager: 'pack' } },
          {
            id: 'page2',
            class: 'ttk.Frame',
            layout: { manager: 'pack' },
            children: [{ id: 'ok', class: 'ttk.Button' }],
          },
        ],
      },
    ],
  },
};

describe('pathTo', () => {
  it('ルートから対象までのノードを返す', () => {
    expect(pathTo(DOC, 'ok')?.map((n) => n.id)).toEqual(['root', 'tabs', 'page2', 'ok']);
    expect(pathTo(DOC, 'root')?.map((n) => n.id)).toEqual(['root']);
  });

  it('見つからなければ undefined', () => {
    expect(pathTo(DOC, 'missing')).toBeUndefined();
  });
});

describe('jsonPathOf', () => {
  it('JSON 上の位置を返す', () => {
    expect(jsonPathOf(DOC, 'ok')).toEqual(['root', 'children', 0, 'children', 1, 'children', 0]);
    expect(jsonPathOf(DOC, 'root')).toEqual(['root']);
    expect(jsonPathOf(DOC, 'missing')).toBeUndefined();
  });
});
