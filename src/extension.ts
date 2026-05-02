import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {

    const disposable = vscode.commands.registerCommand('tk-designer.openDesigner', () => {

        const panel = vscode.window.createWebviewPanel(
            'tkDesigner',
            'TK Designer',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(context.extensionUri, 'dist'),
                    vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview')
                ]
            }
        );

        panel.webview.html = getWebviewContent(context, panel);
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}

function getWebviewContent(context: vscode.ExtensionContext, panel: vscode.WebviewPanel): string {

    const scriptUri = panel.webview.asWebviewUri(
        vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview', 'main.js')
    );

    const styleUri = panel.webview.asWebviewUri(
        vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview', 'style.css')
    );

    return /* html */ `
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<link rel="stylesheet" href="${styleUri}">
<style>
    body {
        margin: 0;
        padding: 0;
        display: flex;
        height: 100vh;
        overflow: hidden;
        font-family: sans-serif;
    }

    #container {
        display: flex;
        width: 100%;
        height: 100%;
    }

    #designer-canvas {
        flex: 1;
        border: 1px solid #ccc;
        background: white;
        width: 80%;
        height: 500px;
        display: block;
    }

    #property-panel {
        width: 220px;
        padding: 10px;
        border-left: 1px solid #ccc;
        background: #f7f7f7;
        box-sizing: border-box;
    }

    .row {
        margin-bottom: 10px;
    }

    label {
        display: inline-block;
        width: 60px;
    }

    input[type="number"] {
        width: 120px;
    }
</style>
</head>
<body>

<div id="container">
    <canvas id="designer-canvas"></canvas>

    <div id="property-panel">
        <div class="row">
            <label>X:</label>
            <input id="prop-x" type="number">
        </div>
        <div class="row">
            <label>Y:</label>
            <input id="prop-y" type="number">
        </div>
        <div class="row">
            <label>Width:</label>
            <input id="prop-w" type="number">
        </div>
        <div class="row">
            <label>Height:</label>
            <input id="prop-h" type="number">
        </div>
    </div>
</div>

<script src="${scriptUri}"></script>
</body>
</html>
`;
}
