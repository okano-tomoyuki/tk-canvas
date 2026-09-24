import { documentStore } from './store/stores.ts';
import { onMessage, postMessage } from './vscode.ts';

/** 拡張ホストからのメッセージをストアにつなぐ。アプリの起動時に1回だけ呼ぶ */
export function connectToHost(): void {
  const store = documentStore.getState();
  onMessage((message) => {
    switch (message.type) {
      case 'document':
        store.receiveDocument(message.version, message.text);
        break;
      case 'editResult':
        store.receiveEditResult(message.requestId, message.ok, message.error);
        break;
    }
  });
  // リスナー登録後に準備完了を通知し、初回のドキュメントを取りこぼさないようにする
  postMessage({ type: 'ready' });
}
