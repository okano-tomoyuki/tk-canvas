/**
 * UI ストア（docs/adr/0006）。選択など、Webview 内で閉じる一時的な状態を持つ。
 * ドキュメントには保存されない。
 */
import { createStore } from 'zustand/vanilla';

export interface UiState {
  /** 選択中のウィジェットの id。削除・改名で存在しなくなった場合は、参照側で未選択として扱う */
  readonly selectedId: string | undefined;
}

export interface UiActions {
  readonly select: (id: string | undefined) => void;
}

export type UiStore = ReturnType<typeof createUiStore>;

export function createUiStore() {
  return createStore<UiState & UiActions>()((set) => ({
    selectedId: undefined,
    select(id) {
      set({ selectedId: id });
    },
  }));
}
