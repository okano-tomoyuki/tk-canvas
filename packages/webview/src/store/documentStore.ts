/**
 * ドキュメントストア（docs/adr/0006）。
 *
 * - 正は拡張ホストが送ってくる TextDocument の内容（confirmed）。
 * - 編集はコマンドとしてホストに送り、応答を待たずにローカルにも適用して表示する（楽観的な反映）。
 * - 応答待ちの編集がある間はローカルの状態を表示し、すべて応答が返ったらホストの最新の内容に揃える。
 */
import {
  applyCommand,
  parseDocument,
  validateDocument,
  type Diagnostic,
  type EditCommand,
  type TkuiDocument,
  type WebviewToExtensionMessage,
} from '@tk-designer/core';
import { createStore } from 'zustand/vanilla';

interface Snapshot {
  /** 構造の検証を通過した場合のみ存在する */
  readonly document: TkuiDocument | undefined;
  readonly diagnostics: readonly Diagnostic[];
}

export interface DocumentState extends Snapshot {
  readonly status: 'loading' | 'loaded';
  /** ホストから最後に受け取った内容 */
  readonly confirmed: Snapshot & { readonly version: number };
  /** 応答待ちの編集の requestId */
  readonly pending: readonly number[];
  /** 直近で拒否された編集の理由 */
  readonly lastError: string | undefined;
}

export interface DocumentActions {
  readonly receiveDocument: (version: number, text: string) => void;
  readonly receiveEditResult: (requestId: number, ok: boolean, error?: string) => void;
  /** コマンドを適用してホストに送る。ローカルで適用できなければ送らずに false を返す */
  readonly dispatch: (command: EditCommand) => boolean;
  readonly clearError: () => void;
}

export type DocumentStore = ReturnType<typeof createDocumentStore>;

export function createDocumentStore(send: (message: WebviewToExtensionMessage) => void) {
  let nextRequestId = 1;

  return createStore<DocumentState & DocumentActions>()((set, get) => ({
    status: 'loading',
    document: undefined,
    diagnostics: [],
    confirmed: { version: -1, document: undefined, diagnostics: [] },
    pending: [],
    lastError: undefined,

    receiveDocument(version, text) {
      const { document, diagnostics } = parseDocument(text);
      const confirmed = { version, document, diagnostics };
      // 応答待ちの編集がある間は、ローカルの（楽観的に反映した）表示を保つ
      set(
        get().pending.length > 0
          ? { confirmed }
          : { status: 'loaded', confirmed, document, diagnostics },
      );
    },

    receiveEditResult(requestId, ok, error) {
      const pending = get().pending.filter((id) => id !== requestId);
      const lastError = ok ? get().lastError : error;
      if (pending.length > 0) {
        set({ pending, lastError });
        return;
      }
      // すべての応答が返ったので、ホストの最新の内容に揃える
      const { confirmed } = get();
      set({
        pending,
        lastError,
        status: 'loaded',
        document: confirmed.document,
        diagnostics: confirmed.diagnostics,
      });
    },

    dispatch(command) {
      const { document } = get();
      if (!document) return false;
      const result = applyCommand(document, command);
      if (!result.ok) {
        set({ lastError: result.error });
        return false;
      }
      const requestId = nextRequestId++;
      set({
        document: result.document,
        diagnostics: validateDocument(result.document),
        pending: [...get().pending, requestId],
        lastError: undefined,
      });
      send({ type: 'edit', requestId, command });
      return true;
    },

    clearError() {
      set({ lastError: undefined });
    },
  }));
}
