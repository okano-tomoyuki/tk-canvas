import type { ExtensionToWebviewMessage, WebviewToExtensionMessage } from '@tk-designer/core';
import * as vscode from 'vscode';

/**
 * *.tkui.json を開くデザイナー。TextDocument を唯一の正とする（docs/adr/0006）。
 */
export class DesignerEditorProvider implements vscode.CustomTextEditorProvider {
  static readonly viewType = 'tkDesigner.designer';

  static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      DesignerEditorProvider.viewType,
      new DesignerEditorProvider(context),
    );
  }

  private readonly context: vscode.ExtensionContext;

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): void {
    const webviewRoot = vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview');
    panel.webview.options = { enableScripts: true, localResourceRoots: [webviewRoot] };
    panel.webview.html = renderHtml(panel.webview, webviewRoot);

    const post = (message: ExtensionToWebviewMessage) => panel.webview.postMessage(message);
    const postDocument = () =>
      post({ type: 'document', version: document.version, text: document.getText() });

    const subscriptions = [
      panel.webview.onDidReceiveMessage((message: WebviewToExtensionMessage) => {
        // メッセージ種別が増えるまでの間、case が常に真と判定されるため抑止する
        switch (message.type) {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          case 'ready':
            void postDocument();
            break;
        }
      }),
      // テキストエディタでの編集や Undo/Redo も、この経路で Webview に届く
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document.uri.toString() === document.uri.toString()) void postDocument();
      }),
    ];
    panel.onDidDispose(() => {
      for (const s of subscriptions) s.dispose();
    });
  }
}

function renderHtml(webview: vscode.Webview, webviewRoot: vscode.Uri): string {
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(webviewRoot, 'main.js'));
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(webviewRoot, 'main.css'));
  const nonce = createNonce();

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${styleUri.toString()}">
  <title>Tk Designer</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" nonce="${nonce}" src="${scriptUri.toString()}"></script>
</body>
</html>`;
}

function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
