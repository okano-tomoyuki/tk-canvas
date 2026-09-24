import { describe, expect, it } from 'vitest';
import type { DiagnosticCode } from './diagnostics.ts';
import { parseDocument } from './parse.ts';

/** テスト用に最小のドキュメントを作り、root を差し替える */
function doc(root: object, variables?: object): string {
  return JSON.stringify({
    formatVersion: 1,
    variables,
    root: { id: 'main_window', class: 'tk.Tk', ...root },
  });
}

function codes(text: string): DiagnosticCode[] {
  return parseDocument(text).diagnostics.map((d) => d.code);
}

const SAMPLE = doc(
  {
    window: { title: 'Sample', geometry: '400x300' },
    layout: { manager: 'grid', columns: { '1': { weight: 1 } } },
    children: [
      {
        id: 'name_entry',
        class: 'ttk.Entry',
        options: { textvariable: { var: 'user_name' } },
        placement: { row: 0, column: 1, sticky: 'ew' },
        bindings: [{ sequence: '<Return>', handler: 'on_submit_key' }],
      },
      {
        id: 'submit_button',
        class: 'ttk.Button',
        options: { text: 'OK', command: { handler: 'on_submit' } },
        placement: { row: 1, column: 1, sticky: 'e' },
      },
      {
        id: 'tabs',
        class: 'ttk.Notebook',
        placement: { row: 2, column: 0, columnspan: 2, sticky: 'nsew' },
        children: [
          {
            id: 'general_page',
            class: 'ttk.Frame',
            placement: { text: 'General' },
            layout: { manager: 'pack' },
          },
        ],
      },
    ],
  },
  { user_name: { type: 'StringVar', value: '' } },
);

describe('parseDocument', () => {
  it('正しいドキュメントは診断なしで読み込める', () => {
    const result = parseDocument(SAMPLE);
    expect(result.diagnostics).toEqual([]);
    expect(result.document?.root.children).toHaveLength(3);
  });

  it('JSON として不正', () => {
    expect(codes('{')).toEqual(['json-syntax']);
  });

  it('未対応の formatVersion', () => {
    expect(codes(JSON.stringify({ formatVersion: 2, root: {} }))).toEqual(['unsupported-version']);
  });

  it('構造エラーは JSON 上の位置と日本語のメッセージを持つ', () => {
    const result = parseDocument(doc({ layout: { manager: 'flow' } }));
    expect(result.document).toBeUndefined();
    expect(result.diagnostics).toMatchObject([
      { code: 'schema', path: ['root', 'layout', 'manager'] },
    ]);
    expect(result.diagnostics[0]?.message).toMatch(/無効/);
  });

  it('変数の値の型は変数型と一致しなければならない', () => {
    expect(codes(doc({}, { count: { type: 'IntVar', value: 'x' } }))).toContain('schema');
  });
});

describe('意味の検証', () => {
  it('名前の重複（ウィジェット・変数・ハンドラは同じ名前空間）', () => {
    const text = doc(
      {
        layout: { manager: 'pack' },
        children: [
          { id: 'ok_button', class: 'ttk.Button', options: { command: { handler: 'user_name' } } },
          { id: 'ok_button', class: 'ttk.Button' },
        ],
      },
      { user_name: { type: 'StringVar' } },
    );
    expect(codes(text).filter((c) => c === 'duplicate-name')).toHaveLength(2);
  });

  it('識別子として使えない名前', () => {
    const result = parseDocument(
      doc({ layout: { manager: 'pack' }, children: [{ id: 'lambda', class: 'ttk.Label' }] }),
    );
    expect(result.diagnostics).toMatchObject([
      { code: 'invalid-identifier', path: ['root', 'children', 0, 'id'] },
    ]);
  });

  it('未定義の変数・変数型の不一致・未使用の変数', () => {
    const text = doc(
      {
        layout: { manager: 'pack' },
        children: [
          { id: 'a', class: 'ttk.Entry', options: { textvariable: { var: 'missing' } } },
          { id: 'b', class: 'ttk.Entry', options: { textvariable: { var: 'count' } } },
        ],
      },
      { count: { type: 'IntVar' }, unused: { type: 'StringVar' } },
    );
    expect(codes(text)).toEqual(['unknown-variable', 'variable-type-mismatch', 'unused-variable']);
  });

  it('参照を置けないオプションと、参照が必須のオプション', () => {
    const text = doc({
      options: { text: { var: 'x' }, command: 'on_click', textvariable: 'name' },
    });
    expect(codes(text)).toEqual([
      'misplaced-reference',
      'reference-required',
      'reference-required',
    ]);
  });

  it('同じハンドラを異なるシグネチャで使うとエラー', () => {
    const text = doc({
      layout: { manager: 'pack' },
      children: [
        { id: 'a', class: 'ttk.Button', options: { command: { handler: 'on_change' } } },
        { id: 'b', class: 'ttk.Scale', options: { command: { handler: 'on_change' } } },
        { id: 'c', class: 'ttk.Entry', bindings: [{ sequence: '<Return>', handler: 'on_change' }] },
      ],
    });
    const result = parseDocument(text);
    expect(result.diagnostics.map((d) => [d.code, d.path.join('.')])).toEqual([
      ['handler-signature-conflict', 'root.children.1.options.command.handler'],
      ['handler-signature-conflict', 'root.children.2.bindings.0.handler'],
    ]);
  });

  it('placement は親の配置方法に合っていなければならない', () => {
    const text = doc({
      layout: { manager: 'grid' },
      children: [{ id: 'a', class: 'ttk.Label', placement: { side: 'left' } }],
    });
    const result = parseDocument(text);
    expect(result.diagnostics).toMatchObject([
      { code: 'placement-mismatch', path: ['root', 'children', 0, 'placement'] },
    ]);
    expect(result.diagnostics[0]?.message).toContain('side');
  });

  it('子を持つのに layout がない', () => {
    expect(codes(doc({ children: [{ id: 'a', class: 'ttk.Label' }] }))).toEqual(['missing-layout']);
  });

  it('Notebook に layout は指定できない', () => {
    const text = doc({
      layout: { manager: 'pack' },
      children: [{ id: 'tabs', class: 'ttk.Notebook', layout: { manager: 'pack' } }],
    });
    expect(codes(text)).toEqual(['layout-not-allowed']);
  });

  it('Tk / Toplevel はルート以外に置けない', () => {
    const text = doc({
      layout: { manager: 'pack' },
      children: [{ id: 'sub', class: 'tk.Toplevel' }],
    });
    expect(codes(text)).toEqual(['invalid-child-class']);
  });
});
