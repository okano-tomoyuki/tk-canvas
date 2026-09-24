import { useEffect, useState } from 'react';
import { onMessage, postMessage } from './vscode.js';

export type DocumentState =
  | { readonly status: 'loading' }
  | { readonly status: 'ok'; readonly version: number; readonly data: unknown }
  | { readonly status: 'invalid'; readonly version: number; readonly error: string };

/** 拡張から届くドキュメントを購読する。暫定実装で、後で Zustand のドキュメントストアに置き換える（ADR 0006）。 */
export function useDocument(): DocumentState {
  const [state, setState] = useState<DocumentState>({ status: 'loading' });

  useEffect(() => {
    const unsubscribe = onMessage((message) => {
      // メッセージ種別が増えるまでの間、case が常に真と判定されるため抑止する
      switch (message.type) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        case 'document':
          setState(parse(message.version, message.text));
          break;
      }
    });
    // リスナー登録後に準備完了を通知し、初回のドキュメントを取りこぼさないようにする
    postMessage({ type: 'ready' });
    return unsubscribe;
  }, []);

  return state;
}

function parse(version: number, text: string): DocumentState {
  try {
    return { status: 'ok', version, data: JSON.parse(text) as unknown };
  } catch (e) {
    return { status: 'invalid', version, error: e instanceof Error ? e.message : String(e) };
  }
}
