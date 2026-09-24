/**
 * アプリ全体で使うストアのインスタンスと、React から購読するためのフック。
 */
import { findNode } from '@tk-designer/core';
import { useStore } from 'zustand';
import { postMessage } from '../vscode.ts';
import { createDocumentStore, type DocumentActions, type DocumentState } from './documentStore.ts';
import { createUiStore, type UiActions, type UiState } from './uiStore.ts';

export const documentStore = createDocumentStore(postMessage);
export const uiStore = createUiStore();

/** セレクタで必要な部分だけを購読する（該当部分が変わったときだけ再描画される） */
export function useDocumentStore<T>(selector: (state: DocumentState & DocumentActions) => T): T {
  return useStore(documentStore, selector);
}

export function useUiStore<T>(selector: (state: UiState & UiActions) => T): T {
  return useStore(uiStore, selector);
}

/** 選択中のノード。選択していない、またはドキュメントに存在しなくなった場合は undefined */
export function useSelectedNode() {
  const selectedId = useUiStore((s) => s.selectedId);
  const document = useDocumentStore((s) => s.document);
  return selectedId && document ? findNode(document, selectedId) : undefined;
}
