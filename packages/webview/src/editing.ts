/**
 * UI から呼び出す編集操作。選択状態を踏まえてコマンドを組み立て、ドキュメントストアに渡す。
 */
import { findNode, getWidgetCatalog, nextWidgetId } from '@tk-designer/core';
import { documentStore, uiStore } from './store/stores.ts';

function current() {
  const { document } = documentStore.getState();
  const { selectedId } = uiStore.getState();
  const selected = document && selectedId ? findNode(document, selectedId) : undefined;
  return { document, selected };
}

/**
 * ウィジェットを追加して選択する。
 * 選択中のウィジェットが子を持てるならその末尾に、そうでなければその直後に追加する。
 */
export function addWidget(className: string): void {
  const { document, selected } = current();
  if (!document) return;

  const selectedIsContainer =
    selected && getWidgetCatalog().classes.get(selected.node.class)?.children !== undefined;
  const target = !selected
    ? { parentId: document.root.id, index: undefined }
    : selectedIsContainer || !selected.parent
      ? { parentId: selected.node.id, index: undefined }
      : { parentId: selected.parent.id, index: selected.index + 1 };

  const id = nextWidgetId(document, className);
  if (documentStore.getState().dispatch({ type: 'addWidget', id, className, ...target })) {
    uiStore.getState().select(id);
  }
}

/** 選択中のウィジェットを削除し、親を選択する */
export function removeSelected(): void {
  const { selected } = current();
  if (!selected?.parent) return;
  if (documentStore.getState().dispatch({ type: 'removeWidget', id: selected.node.id })) {
    uiStore.getState().select(selected.parent.id);
  }
}

/** 選択中のウィジェットを同じ親の中で前後に移動する */
export function moveSelected(delta: -1 | 1): void {
  const { selected } = current();
  if (!selected?.parent) return;
  const index = selected.index + delta;
  const siblings = selected.parent.children?.length ?? 0;
  if (index < 0 || index >= siblings) return;
  documentStore.getState().dispatch({
    type: 'moveWidget',
    id: selected.node.id,
    parentId: selected.parent.id,
    index,
  });
}

/** ウィジェットの名前を変更し、選択を追従させる */
export function renameWidget(id: string, newId: string): void {
  if (documentStore.getState().dispatch({ type: 'renameWidget', id, newId })) {
    uiStore.getState().select(newId);
  }
}
