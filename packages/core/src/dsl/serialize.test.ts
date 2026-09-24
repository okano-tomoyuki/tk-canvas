import { describe, expect, it } from 'vitest';
import { parseDocument } from './parse.ts';
import type { TkuiDocument } from './schema.ts';
import { serializeDocument } from './serialize.ts';

const DOCUMENT: TkuiDocument = {
  // キーの順序をわざと崩しておく
  root: {
    children: [
      {
        placement: { sticky: 'ew', column: 1, row: 0, padx: [4, 8] },
        options: { width: 30, textvariable: { var: 'user_name' } },
        class: 'ttk.Entry',
        id: 'name_entry',
      },
    ],
    layout: { rows: { '10': { weight: 1 }, '2': { weight: 1 } }, manager: 'grid' },
    window: { resizable: [true, false], title: 'Sample' },
    class: 'tk.Tk',
    id: 'main_window',
  },
  variables: { user_name: { value: '', type: 'StringVar' } },
  formatVersion: 1,
};

const EXPECTED = `{
  "formatVersion": 1,
  "variables": {
    "user_name": {
      "type": "StringVar",
      "value": ""
    }
  },
  "root": {
    "id": "main_window",
    "class": "tk.Tk",
    "window": {
      "title": "Sample",
      "resizable": [true, false]
    },
    "layout": {
      "manager": "grid",
      "rows": {
        "2": {
          "weight": 1
        },
        "10": {
          "weight": 1
        }
      }
    },
    "children": [
      {
        "id": "name_entry",
        "class": "ttk.Entry",
        "options": {
          "textvariable": {
            "var": "user_name"
          },
          "width": 30
        },
        "placement": {
          "row": 0,
          "column": 1,
          "sticky": "ew",
          "padx": [4, 8]
        }
      }
    ]
  }
}
`;

describe('serializeDocument', () => {
  it('キーを正規の順序に並べ、プリミティブの配列は1行で書く', () => {
    expect(serializeDocument(DOCUMENT)).toBe(EXPECTED);
  });

  it('読み込み → 書き出しで内容が変わらない（冪等）', () => {
    const parsed = parseDocument(EXPECTED).document;
    expect(parsed).toBeDefined();
    if (parsed) expect(serializeDocument(parsed)).toBe(EXPECTED);
  });
});
