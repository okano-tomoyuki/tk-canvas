import {
  findNode,
  serializeDocument,
  type TkuiDocument,
  type WebviewToExtensionMessage,
} from '@tk-designer/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDocumentStore, type DocumentStore } from './documentStore.ts';

const DOC: TkuiDocument = {
  formatVersion: 1,
  root: { id: 'main_window', class: 'tk.Tk', layout: { manager: 'pack' } },
};
const TEXT = serializeDocument(DOC);

let sent: WebviewToExtensionMessage[];
let store: DocumentStore;

beforeEach(() => {
  sent = [];
  store = createDocumentStore((message) => sent.push(message));
  store.getState().receiveDocument(1, TEXT);
});

function addLabel(id = 'label1') {
  return store
    .getState()
    .dispatch({ type: 'addWidget', parentId: 'main_window', id, className: 'ttk.Label' });
}

function hasWidget(id: string): boolean {
  const { document } = store.getState();
  return document !== undefined && findNode(document, id) !== undefined;
}

describe('documentStore', () => {
  it('ホストから受け取った内容を読み込む', () => {
    expect(store.getState()).toMatchObject({ status: 'loaded', confirmed: { version: 1 } });
    expect(store.getState().document?.root.id).toBe('main_window');
  });

  it('編集はローカルに即座に反映し、コマンドをホストへ送る', () => {
    expect(addLabel()).toBe(true);
    expect(hasWidget('label1')).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ type: 'edit', requestId: 1, command: { type: 'addWidget' } });
    expect(store.getState().pending).toEqual([1]);
  });

  it('応答待ちの間は、途中の版が届いてもローカルの表示を保つ', () => {
    addLabel('label1');
    addLabel('label2');
    // 1つ目の編集だけが反映された版が届く
    const afterFirst = serializeDocument({
      ...DOC,
      root: {
        ...DOC.root,
        children: [{ id: 'label1', class: 'ttk.Label', options: { text: 'label1' } }],
      },
    });
    store.getState().receiveDocument(2, afterFirst);
    store.getState().receiveEditResult(1, true);

    expect(hasWidget('label2')).toBe(true);
    expect(store.getState().confirmed.version).toBe(2);
  });

  it('すべての応答が返ったら、ホストの内容に揃える', () => {
    addLabel();
    store.getState().receiveEditResult(1, true);
    // ホストから新しい版が届いていなければ、最後に確定した内容に戻る
    expect(hasWidget('label1')).toBe(false);
    expect(store.getState().pending).toEqual([]);
  });

  it('ホストが拒否した編集は取り消され、理由を表示する', () => {
    addLabel();
    store.getState().receiveEditResult(1, false, 'だめでした');
    expect(hasWidget('label1')).toBe(false);
    expect(store.getState().lastError).toBe('だめでした');
  });

  it('ローカルで適用できないコマンドは送らない', () => {
    expect(store.getState().dispatch({ type: 'removeWidget', id: 'main_window' })).toBe(false);
    expect(sent).toEqual([]);
    expect(store.getState().lastError).toContain('ルート');
  });
});
