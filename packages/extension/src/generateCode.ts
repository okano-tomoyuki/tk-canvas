/**
 * コード生成（docs/adr/0010、docs/codegen-design.md）。デザイナーの「コード生成」ボタンから呼ばれる。
 */
import { generateAll, resolveTargets, type OutputFile } from '@tk-designer/codegen';
import { hasErrors, parseDocument, type CodegenSettings } from '@tk-designer/core';
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

  // 生成先が未設定なら、どの言語で生成するかを選んでもらい、DSL の codegen に追加する
  if (!targets.python && !targets.cpp) {
    const codegen = await pickTargets();
    if (!codegen) return;
    const result = await applyEditCommand(document, { type: 'setCodegen', codegen });
    if (!result.ok) {
      void vscode.window.showErrorMessage(result.error);
      return;
    }
    doc = parseDocument(document.getText()).document ?? doc;
    targets = resolveTargets(doc, fileName);
  }

  // 出力先の既存の内容を先に読んでおく（生成は同期的に行う）
  const directory = vscode.Uri.joinPath(document.uri, '..');
  const paths = [targets.python?.file, targets.cpp?.header, targets.cpp?.source].filter(
    (p): p is string => p !== undefined,
  );
  const existing = new Map<string, string | undefined>();
  for (const path of paths)
    existing.set(path, await readText(vscode.Uri.joinPath(directory, path)));

  const generated = generateAll(doc, fileName, (path) => existing.get(path));
  if ('error' in generated) {
    void vscode.window.showErrorMessage(generated.error);
    return;
  }
  const failed = generated.files.find((f) => !f.result.ok);
  if (failed && !failed.result.ok) {
    void vscode.window.showErrorMessage(`${failed.path}: ${failed.result.error}`);
    return;
  }
  for (const warning of generated.warnings) void vscode.window.showWarningMessage(warning);

  const files = generated.files.filter(
    (f): f is OutputFile & { result: { ok: true } } => f.result.ok,
  );
  const modified = files.filter((f) => f.result.modifiedRegions.length > 0);
  if (modified.length > 0) {
    const overwrite = '上書きする';
    const list = modified
      .map((f) => `${f.path}（${f.result.modifiedRegions.join(', ')}）`)
      .join('、');
    const answer = await vscode.window.showWarningMessage(
      `自動生成区間が手で編集されています: ${list}。上書きしますか？`,
      { modal: true },
      overwrite,
    );
    if (answer !== overwrite) return;
  }

  const changed = files.filter((f) => existing.get(f.path) !== f.result.text);
  if (changed.length === 0) {
    void vscode.window.showInformationMessage(
      `${files.map((f) => f.path).join('、')} は最新です。`,
    );
    return;
  }
  for (const file of changed) {
    await writeText(
      vscode.Uri.joinPath(directory, file.path),
      existing.get(file.path),
      file.result.text,
    );
  }

  const stubs = [...new Set(changed.flatMap((f) => f.result.addedStubs))];
  const details = stubs.length > 0 ? `（ハンドラの雛形を追加: ${stubs.join(', ')}）` : '';
  const summary = changed
    .map((f) => `${f.path}（${existing.get(f.path) === undefined ? '作成' : '更新'}）`)
    .join('、');
  const open = '開く';
  const answer = await vscode.window.showInformationMessage(
    `生成しました: ${summary}${details}`,
    open,
  );
  if (answer === open) {
    for (const file of changed) {
      await vscode.window.showTextDocument(vscode.Uri.joinPath(directory, file.path), {
        preview: false,
      });
    }
  }
}

/** 生成する言語を選んでもらう。取り消されたら undefined */
async function pickTargets(): Promise<CodegenSettings | undefined> {
  const items: (vscode.QuickPickItem & { codegen: CodegenSettings })[] = [
    { label: 'Python（tkinter）', description: '<名前>.py', codegen: { python: {} } },
    { label: 'C++（cpp_tk）', description: '<名前>.hpp / <名前>.cpp', codegen: { cpp: {} } },
    { label: 'Python と C++ の両方', codegen: { python: {}, cpp: {} } },
  ];
  const picked = await vscode.window.showQuickPick(items, {
    title:
      '生成先が設定されていません。生成する言語を選んでください（DSL の codegen に追加します）',
  });
  return picked?.codegen;
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
