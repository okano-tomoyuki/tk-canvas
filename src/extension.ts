import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {

  const disposable = vscode.commands.registerCommand('tk-designer.openDesigner', async () => {

    const panel = vscode.window.createWebviewPanel(
      'tkDesigner',
      'TK Designer',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'media'),
          vscode.Uri.joinPath(context.extensionUri, 'media', 'webview'),
          vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview')
        ]
      }
    );

    const html = await getWebviewContent(context, panel);
    panel.webview.html = html;

    // Webview → Extension のメッセージ受信
    panel.webview.onDidReceiveMessage(async msg => {
      switch (msg.type) {
        case 'save-json': {
          const json = msg.data;

          const uri = await vscode.window.showSaveDialog({
            filters: { 'JSON Files': ['json'] },
            saveLabel: '保存'
          });

          if (!uri) {
            vscode.window.showInformationMessage("保存がキャンセルされました");
            return;
          }

          // ★ Buffer を使わずに保存する（Webview 拡張の正しい方法）
          const encoder = new TextEncoder();
          const bytes = encoder.encode(JSON.stringify(json, null, 2));

          await vscode.workspace.fs.writeFile(uri, bytes);

          vscode.window.showInformationMessage("保存しました: " + uri.fsPath);
          break;
        }
        // --- 読込処理（新規） ---
        case 'request-load': {
            const uri = await vscode.window.showOpenDialog({
                canSelectMany: false,
                filters: { 'JSON Files': ['json'] },
                openLabel: '読込'
            });

            if (!uri || uri.length === 0) {
              return;
            }

            const bytes = await vscode.workspace.fs.readFile(uri[0]);
            const jsonString = new TextDecoder('utf8').decode(bytes);

            // Webview に返す
            panel.webview.postMessage({
                type: "load-json",
                data: jsonString
            });

            break;
        }

      }
    });

  });

  context.subscriptions.push(disposable);
}

export function deactivate() { }

async function getWebviewContent(context: vscode.ExtensionContext, panel: vscode.WebviewPanel): Promise<string> {

  const htmlPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'webview', 'index.html');
  const htmlBytes = await vscode.workspace.fs.readFile(htmlPath);
  let html = new TextDecoder('utf-8').decode(htmlBytes);

  const cspSource = panel.webview.cspSource;

  // Webview 用の URI を生成
  const scriptUri = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview', 'main.js')
  );

  const styleUri = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, 'media', 'webview', 'style.css')
  );

  const iconBase = vscode.Uri.joinPath(context.extensionUri, 'media', 'webview', 'icons');

  const iconButton = panel.webview.asWebviewUri(vscode.Uri.joinPath(iconBase, 'button.svg'));
  const iconCheckbutton = panel.webview.asWebviewUri(vscode.Uri.joinPath(iconBase, 'checkbutton.svg'));
  const iconLabel = panel.webview.asWebviewUri(vscode.Uri.joinPath(iconBase, 'label.svg'));
  const iconFrame = panel.webview.asWebviewUri(vscode.Uri.joinPath(iconBase, 'frame.svg'));
  const iconEntry = panel.webview.asWebviewUri(vscode.Uri.joinPath(iconBase, 'entry.svg'));
  const iconText = panel.webview.asWebviewUri(vscode.Uri.joinPath(iconBase, 'text.svg'));
  const iconRadiobutton = panel.webview.asWebviewUri(vscode.Uri.joinPath(iconBase, 'radiobutton.svg'));
  const iconScale = panel.webview.asWebviewUri(vscode.Uri.joinPath(iconBase, 'scale.svg'));
  const iconNotebook = panel.webview.asWebviewUri(vscode.Uri.joinPath(iconBase, 'notebook.svg'));

  // プレースホルダ置換（正攻法）
  html = html
    .replace(/\$\{cspSource\}/g, cspSource)
    .replace(/\$\{scriptUri\}/g, scriptUri.toString())
    .replace(/\$\{styleUri\}/g, styleUri.toString())
    .replace(/\$\{iconButton\}/g, iconButton.toString())
    .replace(/\$\{iconCheckbutton\}/g, iconCheckbutton.toString())
    .replace(/\$\{iconLabel\}/g, iconLabel.toString())
    .replace(/\$\{iconFrame\}/g, iconFrame.toString())
    .replace(/\$\{iconRadiobutton\}/g, iconRadiobutton.toString())
    .replace(/\$\{iconText\}/g, iconText.toString())
    .replace(/\$\{iconScale\}/g, iconScale.toString())
    .replace(/\$\{iconNotebook\}/g, iconNotebook.toString())
    .replace(/\$\{iconEntry\}/g, iconEntry.toString());

  return html;
}
