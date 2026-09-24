/**
 * 拡張ホストと Webview の間で交わすメッセージの型（docs/adr/0006）。
 * 両者はこの型を介してのみ通信し、互いのコードを直接 import しない。
 */

export type ExtensionToWebviewMessage = {
  readonly type: 'document';
  /** TextDocument.version。Webview の楽観的更新との食い違い検出に使う */
  readonly version: number;
  readonly text: string;
};

export type WebviewToExtensionMessage = {
  readonly type: 'ready';
};
