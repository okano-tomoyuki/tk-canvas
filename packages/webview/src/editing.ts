/**
 * UI から呼び出す編集操作。選択状態を踏まえてコマンドを組み立て、ドキュメントストアに渡す。
 */
import {
  findNode,
  getWidgetCatalog,
  nextMemberName,
  nextWidgetId,
  sequenceToName,
  type VariableType,
} from '@tk-designer/core';
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

const VARIABLE_NAME_BASES: Readonly<Record<VariableType, string>> = {
  StringVar: 'text_var',
  IntVar: 'int_var',
  DoubleVar: 'double_var',
  BooleanVar: 'bool_var',
};

/** 変数を追加する */
export function addVariable(type: VariableType): void {
  const { document } = documentStore.getState();
  if (!document) return;
  const name = nextMemberName(document, VARIABLE_NAME_BASES[type]);
  documentStore.getState().dispatch({ type: 'setVariable', name, variable: { type } });
}

/** オプション用の変数を新しく作り、そのオプションから参照する（Undo 1回で両方戻る） */
export function createVariableFor(nodeId: string, optionName: string, type: VariableType): void {
  const { document } = documentStore.getState();
  if (!document) return;
  const suffix = optionName.replace(/variable$/, '') || 'value';
  const name = nextMemberName(document, `${nodeId}_${suffix}`);
  documentStore.getState().dispatch({
    type: 'batch',
    commands: [
      { type: 'setVariable', name, variable: { type } },
      { type: 'setOption', id: nodeId, name: optionName, value: { var: name } },
    ],
  });
}

/** bind を1つ追加する。まだ使っていないイベント候補と、それに合うハンドラ名を初期値にする */
export function addBinding(nodeId: string): void {
  const { document } = documentStore.getState();
  const node = document && findNode(document, nodeId)?.node;
  if (!document || !node) return;
  const used = new Set((node.bindings ?? []).map((b) => b.sequence));
  const candidates = getWidgetCatalog().classes.get(node.class)?.events ?? ['<Button-1>'];
  const sequence = candidates.find((c) => !used.has(c)) ?? '<Button-1>';
  const handler = nextMemberName(document, `on_${nodeId}_${sequenceToName(sequence)}`);
  documentStore.getState().dispatch({
    type: 'setBindings',
    id: nodeId,
    bindings: [...(node.bindings ?? []), { sequence, handler }],
  });
}
