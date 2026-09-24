/** テスト用のドキュメント（codegen-design.md の生成例に、いくつかのウィジェットを加えたもの） */
import type { TkuiDocument } from '@tk-designer/core';

export const SAMPLE: TkuiDocument = {
  formatVersion: 1,
  codegen: { python: {} },
  variables: {
    user_name: { type: 'StringVar', value: '' },
    mode: { type: 'IntVar', value: 1 },
    level: { type: 'DoubleVar' },
  },
  root: {
    id: 'main_window',
    class: 'tk.Tk',
    window: { title: 'Sample', geometry: '400x300', resizable: [true, false], minsize: [200, 100] },
    layout: { manager: 'grid', columns: { '1': { weight: 1 } }, rows: { '3': { weight: 1 } } },
    children: [
      {
        id: 'name_label',
        class: 'ttk.Label',
        options: { text: 'Name:' },
        placement: { row: 0, column: 0, sticky: 'w', padx: [8, 4] },
      },
      {
        id: 'name_entry',
        class: 'ttk.Entry',
        options: { textvariable: { var: 'user_name' }, font: ['Arial', 12, 'bold'] },
        placement: { row: 0, column: 1, sticky: 'ew' },
        bindings: [{ sequence: '<Return>', handler: 'on_name_return' }],
      },
      {
        id: 'mode_a',
        class: 'ttk.Radiobutton',
        options: { text: 'A', variable: { var: 'mode' }, value: 1 },
        placement: { row: 1, column: 0 },
      },
      {
        id: 'mode_b',
        class: 'ttk.Radiobutton',
        options: { text: 'B', variable: { var: 'mode' }, value: 2 },
        placement: { row: 1, column: 1, sticky: 'w' },
      },
      {
        id: 'level_scale',
        class: 'ttk.Scale',
        options: { from: 0, to: 10, variable: { var: 'level' }, command: { handler: 'on_level' } },
        placement: { row: 2, column: 0, columnspan: 2, sticky: 'ew' },
      },
      {
        id: 'tabs',
        class: 'ttk.Notebook',
        placement: { row: 3, column: 0, columnspan: 2, sticky: 'nsew' },
        children: [
          {
            id: 'general_page',
            class: 'ttk.Frame',
            options: { padding: 8 },
            placement: { text: 'General' },
            layout: { manager: 'pack', propagate: false },
            children: [
              {
                id: 'submit_button',
                class: 'ttk.Button',
                options: { text: 'OK', command: { handler: 'on_submit' } },
                placement: { side: 'right' },
              },
            ],
          },
        ],
      },
    ],
  },
};
