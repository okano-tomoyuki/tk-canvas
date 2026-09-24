import * as vscode from 'vscode';
import { DesignerEditorProvider } from './designerEditorProvider.ts';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(DesignerEditorProvider.register(context));
}

export function deactivate(): void {}
