import { describe, expect, it } from 'vitest';
import { parseDocument } from '../dsl/parse.ts';
import type { TkuiDocument } from '../dsl/schema.ts';
import { applyCommand, type EditCommand } from './commands.ts';
import { nextWidgetId } from './defaults.ts';
import { findNode } from './tree.ts';

const BASE: TkuiDocument = {
  formatVersion: 1,
  root: {
    id: 'main_window',
    class: 'tk.Tk',
    layout: { manager: 'grid' },
    children: [
      {
        id: 'form',
        class: 'ttk.Frame',
        layout: { manager: 'pack' },
        placement: { row: 0, column: 0 },
        children: [{ id: 'ok_button', class: 'ttk.Button', options: { text: 'OK' } }],
      },
      { id: 'tabs', class: 'ttk.Notebook', placement: { row: 1, column: 0 } },
    ],
  },
};

function run(...commands: EditCommand[]): TkuiDocument {
  let doc = BASE;
  for (const command of commands) {
    const result = applyCommand(doc, command);
    if (!result.ok) throw new Error(result.error);
    doc = result.document;
  }
  return doc;
}

function errorOf(command: EditCommand): string {
  const result = applyCommand(BASE, command);
  return result.ok ? '' : result.error;
}

/** 編集結果が常に検証を通ること */
function expectValid(doc: TkuiDocument) {
  expect(parseDocument(JSON.stringify(doc)).diagnostics).toEqual([]);
}

describe('applyCommand', () => {
  it('元のドキュメントは変更しない（不変更新）', () => {
    run({ type: 'removeWidget', id: 'ok_button' });
    expect(findNode(BASE, 'ok_button')).toBeDefined();
  });

  describe('addWidget', () => {
    it('親の置き方に応じた初期値を与える（grid なら次の行）', () => {
      const doc = run({
        type: 'addWidget',
        parentId: 'main_window',
        id: 'label1',
        className: 'ttk.Label',
      });
      expect(findNode(doc, 'label1')?.node).toEqual({
        id: 'label1',
        class: 'ttk.Label',
        options: { text: 'label1' },
        placement: { row: 2, column: 0 },
      });
      expectValid(doc);
    });

    it('Notebook の子にはタブ名、コンテナには layout を与える', () => {
      const doc = run({ type: 'addWidget', parentId: 'tabs', id: 'page1', className: 'ttk.Frame' });
      expect(findNode(doc, 'page1')?.node).toEqual({
        id: 'page1',
        class: 'ttk.Frame',
        layout: { manager: 'grid' },
        placement: { text: 'page1' },
      });
      expectValid(doc);
    });

    it('位置を指定して挿入できる', () => {
      const doc = run({
        type: 'addWidget',
        parentId: 'form',
        id: 'b0',
        className: 'ttk.Button',
        index: 0,
      });
      expect(findNode(doc, 'b0')?.index).toBe(0);
    });

    it.each([
      [{ parentId: 'ok_button', id: 'x', className: 'ttk.Label' }, '子を持てません'],
      [{ parentId: 'form', id: 'ok_button', className: 'ttk.Label' }, '既に使われています'],
      [{ parentId: 'form', id: 'class', className: 'ttk.Label' }, '名前として使えません'],
      [{ parentId: 'form', id: 'x', className: 'tk.Toplevel' }, '追加できません'],
      [{ parentId: 'nowhere', id: 'x', className: 'ttk.Label' }, '見つかりません'],
    ])('エラー: %o', (params, message) => {
      expect(errorOf({ type: 'addWidget', ...params })).toContain(message);
    });
  });

  describe('removeWidget / moveWidget', () => {
    it('最後の子を削除すると children も取り除く', () => {
      const doc = run({ type: 'removeWidget', id: 'ok_button' });
      expect(findNode(doc, 'form')?.node.children).toBeUndefined();
      expectValid(doc);
    });

    it('置き方の異なる親へ移動すると placement を付け直す', () => {
      const doc = run({ type: 'moveWidget', id: 'ok_button', parentId: 'main_window', index: 0 });
      expect(findNode(doc, 'ok_button')).toMatchObject({
        index: 0,
        node: { placement: { row: 2, column: 0 } },
      });
      expect(findNode(doc, 'form')?.node.children).toBeUndefined();
      expectValid(doc);
    });

    it('自分の子孫へは移動できない', () => {
      const doc = run({ type: 'addWidget', parentId: 'form', id: 'inner', className: 'ttk.Frame' });
      const result = applyCommand(doc, {
        type: 'moveWidget',
        id: 'form',
        parentId: 'inner',
        index: 0,
      });
      expect(result.ok).toBe(false);
    });

    it('ルートは削除できない', () => {
      expect(errorOf({ type: 'removeWidget', id: 'main_window' })).toContain('ルート');
    });
  });

  describe('renameWidget / setOption / setPlacement / setLayout', () => {
    it('名前の変更', () => {
      const doc = run({ type: 'renameWidget', id: 'ok_button', newId: 'submit_button' });
      expect(findNode(doc, 'submit_button')).toBeDefined();
      expect(errorOf({ type: 'renameWidget', id: 'ok_button', newId: 'form' })).toContain(
        '既に使われています',
      );
    });

    it('オプションの設定と削除（空になれば options ごと取り除く）', () => {
      const set = run({ type: 'setOption', id: 'ok_button', name: 'width', value: 10 });
      expect(findNode(set, 'ok_button')?.node.options).toEqual({ text: 'OK', width: 10 });

      const removed = run({ type: 'setOption', id: 'ok_button', name: 'text', value: undefined });
      expect(findNode(removed, 'ok_button')?.node.options).toBeUndefined();
    });

    it('placement の設定', () => {
      const doc = run({
        type: 'setPlacement',
        id: 'ok_button',
        placement: { side: 'left', fill: 'y' },
      });
      expect(findNode(doc, 'ok_button')?.node).toMatchObject({
        placement: { side: 'left', fill: 'y' },
      });
      expectValid(doc);
    });

    it('manager を変えると子の placement を新しい manager の初期値にする', () => {
      const doc = run(
        { type: 'addWidget', parentId: 'form', id: 'cancel_button', className: 'ttk.Button' },
        { type: 'setLayout', id: 'form', layout: { manager: 'grid' } },
      );
      const form = findNode(doc, 'form')?.node;
      expect(form?.children?.map((c) => c.placement)).toEqual([
        { row: 0, column: 0 },
        { row: 1, column: 0 },
      ]);
      expectValid(doc);
    });
  });
});

describe('nextWidgetId', () => {
  it('ウィジェット・ハンドラ・変数と重ならない番号を振る', () => {
    const doc: TkuiDocument = {
      ...BASE,
      variables: { button2: { type: 'StringVar' } },
      root: { ...BASE.root, options: {} },
    };
    const withButton1 = run({
      type: 'addWidget',
      parentId: 'form',
      id: 'button1',
      className: 'ttk.Button',
    });
    expect(nextWidgetId(BASE, 'ttk.Button')).toBe('button1');
    expect(nextWidgetId({ ...withButton1, variables: doc.variables }, 'ttk.Button')).toBe(
      'button3',
    );
  });
});

describe('setWindow', () => {
  it('設定し、空の項目は取り除く', () => {
    const result = applyCommand(BASE, {
      type: 'setWindow',
      window: { title: 'App', geometry: undefined },
    });
    expect(result.ok && result.document.root.window).toEqual({ title: 'App' });
  });

  it('すべて空なら window ごと取り除く', () => {
    const withTitle = applyCommand(BASE, { type: 'setWindow', window: { title: 'App' } });
    if (!withTitle.ok) throw new Error(withTitle.error);
    const cleared = applyCommand(withTitle.document, { type: 'setWindow', window: {} });
    expect(cleared.ok && cleared.document.root.window).toBeUndefined();
  });
});

describe('変数', () => {
  const WITH_VAR = run(
    { type: 'setVariable', name: 'user_name', variable: { type: 'StringVar', value: '' } },
    { type: 'addWidget', parentId: 'form', id: 'name_entry', className: 'ttk.Entry' },
    { type: 'setOption', id: 'name_entry', name: 'textvariable', value: { var: 'user_name' } },
  );

  it('追加・変更', () => {
    expect(WITH_VAR.variables).toEqual({ user_name: { type: 'StringVar', value: '' } });
    expectValid(WITH_VAR);
    const changed = applyCommand(WITH_VAR, {
      type: 'setVariable',
      name: 'user_name',
      variable: { type: 'StringVar', value: 'guest' },
    });
    expect(changed.ok && changed.document.variables?.user_name).toEqual({
      type: 'StringVar',
      value: 'guest',
    });
  });

  it('既存のウィジェットと同じ名前では追加できない', () => {
    expect(errorOf({ type: 'setVariable', name: 'form', variable: { type: 'IntVar' } })).toContain(
      '既に使われています',
    );
  });

  it('改名すると参照も置き換える', () => {
    const result = applyCommand(WITH_VAR, {
      type: 'renameVariable',
      name: 'user_name',
      newName: 'login',
    });
    if (!result.ok) throw new Error(result.error);
    expect(Object.keys(result.document.variables ?? {})).toEqual(['login']);
    expect(findNode(result.document, 'name_entry')?.node.options).toEqual({
      textvariable: { var: 'login' },
    });
    expectValid(result.document);
  });

  it('削除すると参照しているオプションも削除する', () => {
    const result = applyCommand(WITH_VAR, { type: 'removeVariable', name: 'user_name' });
    if (!result.ok) throw new Error(result.error);
    expect(result.document.variables).toBeUndefined();
    expect(findNode(result.document, 'name_entry')?.node.options).toBeUndefined();
    expectValid(result.document);
  });
});

describe('イベント', () => {
  it('bindings の設定と、空にしたときの削除', () => {
    const set = run({
      type: 'setBindings',
      id: 'ok_button',
      bindings: [{ sequence: '<Return>', handler: 'on_submit' }],
    });
    expect(findNode(set, 'ok_button')?.node.bindings).toEqual([
      { sequence: '<Return>', handler: 'on_submit' },
    ]);
    const cleared = applyCommand(set, { type: 'setBindings', id: 'ok_button', bindings: [] });
    expect(cleared.ok && findNode(cleared.document, 'ok_button')?.node.bindings).toBeUndefined();
  });

  it('ハンドラの改名は command と bindings の両方に反映する', () => {
    const doc = run(
      { type: 'setOption', id: 'ok_button', name: 'command', value: { handler: 'on_ok' } },
      {
        type: 'setBindings',
        id: 'ok_button',
        bindings: [{ sequence: '<Return>', handler: 'on_ok' }],
      },
      { type: 'renameHandler', name: 'on_ok', newName: 'on_submit' },
    );
    const node = findNode(doc, 'ok_button')?.node;
    expect(node?.options?.command).toEqual({ handler: 'on_submit' });
    expect(node?.bindings).toEqual([{ sequence: '<Return>', handler: 'on_submit' }]);
  });

  it('ウィジェットと同じ名前へのハンドラの改名はできない', () => {
    const doc = run({
      type: 'setOption',
      id: 'ok_button',
      name: 'command',
      value: { handler: 'on_ok' },
    });
    const result = applyCommand(doc, { type: 'renameHandler', name: 'on_ok', newName: 'form' });
    expect(result.ok).toBe(false);
  });
});

describe('batch', () => {
  it('まとめて適用する', () => {
    const doc = run({
      type: 'batch',
      commands: [
        { type: 'setVariable', name: 'agree', variable: { type: 'BooleanVar' } },
        { type: 'addWidget', parentId: 'form', id: 'agree_check', className: 'ttk.Checkbutton' },
        { type: 'setOption', id: 'agree_check', name: 'variable', value: { var: 'agree' } },
      ],
    });
    expectValid(doc);
  });

  it('途中で失敗したら何も変えない', () => {
    const result = applyCommand(BASE, {
      type: 'batch',
      commands: [
        { type: 'setVariable', name: 'x', variable: { type: 'IntVar' } },
        { type: 'removeWidget', id: 'main_window' },
      ],
    });
    expect(result.ok).toBe(false);
    expect(BASE.variables).toBeUndefined();
  });
});

describe('setCodegen', () => {
  it('設定と削除', () => {
    const set = run({ type: 'setCodegen', codegen: { python: {} } });
    expect(set.codegen).toEqual({ python: {} });
    expectValid(set);
    const cleared = applyCommand(set, { type: 'setCodegen', codegen: {} });
    expect(cleared.ok && cleared.document.codegen).toBeUndefined();
  });
});
