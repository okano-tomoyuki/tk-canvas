import type { ExtensionToWebviewMessage, WebviewToExtensionMessage } from '@tk-designer/core';

// acquireVsCodeApi は1つの Webview につき1回しか呼べないため、モジュールで1度だけ取得する
const vscode = acquireVsCodeApi();

export function postMessage(message: WebviewToExtensionMessage): void {
  vscode.postMessage(message);
}

export function onMessage(listener: (message: ExtensionToWebviewMessage) => void): () => void {
  const handler = (event: MessageEvent<ExtensionToWebviewMessage>) => {
    listener(event.data);
  };
  window.addEventListener('message', handler);
  return () => {
    window.removeEventListener('message', handler);
  };
}
