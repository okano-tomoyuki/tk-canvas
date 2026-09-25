import * as vscode from 'vscode';
import { DesignerEditorProvider } from './designerEditorProvider.ts';
import { newScreen } from './newScreen.ts';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    DesignerEditorProvider.register(context),
    vscode.commands.registerCommand('tkDesigner.newScreen', (target?: vscode.Uri) =>
      newScreen(target),
    ),
  );
}

export function deactivate(): void {}
