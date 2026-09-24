/**
 * UI ストア（docs/adr/0006）。選択・ハイライト・ドラッグなど、Webview 内で閉じる一時的な状態を持つ。
 * ドキュメントには保存されない。
 */
import { createStore } from 'zustand/vanilla';

/** ドラッグ中のもの。パレットからの新しいウィジェット、またはキャンバス上の既存のウィジェット */
export type Dragging =
  | { readonly kind: 'new'; readonly className: string }
  | { readonly kind: 'move'; readonly id: string };

export interface UiState {
  /** 選択中のウィジェットの id。削除・改名で存在しなくなった場合は、参照側で未選択として扱う */
  readonly selectedId: string | undefined;
  /** サイドバーでマウスを乗せている変数（参照しているウィジェットをキャンバスで強調する） */
  readonly hoveredVariable: string | undefined;
  readonly dragging: Dragging | undefined;
}

export interface UiActions {
  readonly select: (id: string | undefined) => void;
  readonly hoverVariable: (name: string | undefined) => void;
  readonly setDragging: (dragging: Dragging | undefined) => void;
}

export type UiStore = ReturnType<typeof createUiStore>;

export function createUiStore() {
  return createStore<UiState & UiActions>()((set) => ({
    selectedId: undefined,
    hoveredVariable: undefined,
    dragging: undefined,
    select(id) {
      set({ selectedId: id });
    },
    hoverVariable(name) {
      set({ hoveredVariable: name });
    },
    setDragging(dragging) {
      set({ dragging });
    },
  }));
}
