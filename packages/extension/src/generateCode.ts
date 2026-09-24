/**
 * コード生成（docs/adr/0010、docs/codegen-design.md）。デザイナーの「コード生成」ボタンから呼ばれる。
 */
import { generatePython, resolveTargets } from '@tk-designer/codegen';
import { hasErrors, parseDocument } from '@tk-designer/core';
import * as vscode from 'vscode';
import { applyEditCommand } from './applyEditCommand.ts';

export async function generateCode(document: vscode.TextDocument): Promise<void> {
  const parsed = parseDocument(document.getText());
  if (!parsed.document || hasErrors(parsed.diagnostics)) {
    void vscode.window.showErrorMessage(
      'DSL に検証エラーがあるため、コードを生成できません。デザイナー下部のエラーを修正してください。',
    );
    return;
  }

  const fileName = document.uri.path.split('/').pop() ?? 'ui.tkui.json';
  let doc = parsed.document;
  let targets = resolveTargets(doc, fileName);

  // 生成先が未設定なら、Python（tkinter）の生成を有効にするか尋ねる
  if (!targets.python && !targets.cpp) {
    const enable = '有効にする';
    const answer = await vscode.window.showInformationMessage(
      `生成先が設定されていません。Python（tkinter）のコード生成を有効にしますか？（DSL に "codegen": { "python": {} } を追加します）`,
      enable,
    );
    if (answer !== enable) return;
    const result = await applyEditCommand(document, {
      type: 'setCodegen',
      codegen: { python: {} },
    });
    if (!result.ok) {
      void vscode.window.showErrorMessage(result.error);
      return;
    }
    doc = parseDocument(document.getText()).document ?? doc;
    targets = resolveTargets(doc, fileName);
  }

  if (targets.cpp) {
    void vscode.window.showWarningMessage('C++（cpp_tk）のコード生成はまだ実装されていません。');
  }
  if (!targets.python) return;

  const directory = vscode.Uri.joinPath(document.uri, '..');
  const target = vscode.Uri.joinPath(directory, targets.python.file);
  const existing = await readText(target);
  const result = generatePython(doc, fileName, existing);
  if (!result.ok) {
    void vscode.window.showErrorMessage(`${targets.python.file}: ${result.error}`);
    return;
  }

  if (result.modifiedRegions.length > 0) {
    const overwrite = '上書きする';
    const answer = await vscode.window.showWarningMessage(
      `${targets.python.file} の自動生成区間（${result.modifiedRegions.join(', ')}）が手で編集されています。上書きしますか？`,
      { modal: true },
      overwrite,
    );
    if (answer !== overwrite) return;
  }

  if (existing === result.text) {
    void vscode.window.showInformationMessage(`${targets.python.file} は最新です。`);
    return;
  }
  await writeText(target, existing, result.text);

  const details =
    result.addedStubs.length > 0 ? `（ハンドラの雛形を追加: ${result.addedStubs.join(', ')}）` : '';
  const open = '開く';
  const answer = await vscode.window.showInformationMessage(
    `${existing === undefined ? '作成' : '更新'}しました: ${targets.python.file}${details}`,
    open,
  );
  if (answer === open) await vscode.window.showTextDocument(target, { preview: false });
}

/** 開いている（未保存の変更を含む）内容、なければファイルの内容。ファイルがなければ undefined */
async function readText(uri: vscode.Uri): Promise<string | undefined> {
  const opened = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString());
  if (opened) return opened.getText();
  try {
    return new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
  } catch {
    return undefined;
  }
}

/**
 * WorkspaceEdit で書き込む（docs/codegen-design.md M8）。開いているエディタにも反映され、Undo もできる。
 * 書き込み前に未保存の変更がなかったファイルは、書き込み後に保存する。
 */
async function writeText(
  uri: vscode.Uri,
  existing: string | undefined,
  text: string,
): Promise<void> {
  const edit = new vscode.WorkspaceEdit();
  if (existing === undefined) {
    edit.createFile(uri, { contents: new TextEncoder().encode(text) });
    await vscode.workspace.applyEdit(edit);
    return;
  }
  const document = await vscode.workspace.openTextDocument(uri);
  const wasDirty = document.isDirty;
  edit.replace(
    uri,
    new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)),
    text,
  );
  await vscode.workspace.applyEdit(edit);
  if (!wasDirty) await document.save();
}
