import { parseDocument, type Diagnostic, type TkuiDocument } from '@tk-designer/core';
import { useEffect, useState } from 'react';
import { onMessage, postMessage } from './vscode.ts';

export type DocumentState =
  | { readonly status: 'loading' }
  | {
      readonly status: 'loaded';
      readonly version: number;
      /** 構造の検証を通過した場合のみ存在する */
      readonly document: TkuiDocument | undefined;
      readonly diagnostics: readonly Diagnostic[];
    };

/** 拡張から届くドキュメントを購読する。暫定実装で、後で Zustand のドキュメントストアに置き換える（ADR 0006）。 */
export function useDocument(): DocumentState {
  const [state, setState] = useState<DocumentState>({ status: 'loading' });

  useEffect(() => {
    const unsubscribe = onMessage((message) => {
      // メッセージ種別が増えるまでの間、case が常に真と判定されるため抑止する
      switch (message.type) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        case 'document': {
          const { document, diagnostics } = parseDocument(message.text);
          setState({ status: 'loaded', version: message.version, document, diagnostics });
          break;
        }
      }
    });
    // リスナー登録後に準備完了を通知し、初回のドキュメントを取りこぼさないようにする
    postMessage({ type: 'ready' });
    return unsubscribe;
  }, []);

  return state;
}
