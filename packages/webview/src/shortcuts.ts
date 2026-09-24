/**
 * キーボード操作。入力欄にフォーカスがあるときは何もしない（文字の削除などを妨げないため）。
 * - Delete: 選択中のウィジェットを削除
 * - Escape: 親を選択
 */
import { removeSelected, selectParent } from './editing.ts';

export function installShortcuts(): () => void {
  const handler = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('input, select, textarea, [contenteditable="true"]')) return;
    switch (e.key) {
      case 'Delete':
        e.preventDefault();
        removeSelected();
        break;
      case 'Escape':
        selectParent();
        break;
    }
  };
  window.addEventListener('keydown', handler);
  return () => {
    window.removeEventListener('keydown', handler);
  };
}
