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
                    vscode.Uri.joinPath(context.extensionUri, 'media'),
                    vscode.Uri.joinPath(context.extensionUri, 'media', 'icons'),
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

    const iconBase = panel.webview.asWebviewUri(
        vscode.Uri.joinPath(context.extensionUri, 'media', 'icons')
    );

    const icon = (name: string) => `${iconBase}/${name}.svg`;

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

<div id="property-panel"></div>

<div id="toolbar">
    <button data-widget="rectangle"><img src="${icon("rectangle")}"></button>
    <button data-widget="label"><img src="${icon("label")}"></button>
    <button data-widget="button"><img src="${icon("button")}"></button>
    <button data-widget="checkbox"><img src="${icon("checkbox")}"></button>
    <button data-widget="textfield"><img src="${icon("textfield")}"></button>
</div>

<div id="container">
    <canvas id="designer-canvas"></canvas>
</div>

<script src="${scriptUri}"></script>
</body>
</html>
`;
}
