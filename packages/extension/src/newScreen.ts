/**
 * 新しい画面（*.tkui.json）を作ってデザイナーで開く（docs/adr/0011）。
 * ルートのクラス（生成されるクラスの基底クラス）を選び、名前を入力する。
 */
import { createDocument, serializeDocument, type RootClass } from '@tk-designer/core';
import * as vscode from 'vscode';
import { DesignerEditorProvider } from './designerEditorProvider.ts';

const EXTENSION = '.tkui.json';

const ROOT_CHOICES: readonly (vscode.QuickPickItem & { readonly rootClass?: RootClass })[] = [
  { label: 'ウィンドウ', kind: vscode.QuickPickItemKind.Separator },
  {
    label: 'tk.Tk',
    description: 'メインウィンドウ',
    detail: 'アプリケーションの最初のウィンドウ。生成したクラスから mainloop() で起動する',
    rootClass: 'tk.Tk',
  },
  {
    label: 'tk.Toplevel',
    description: 'サブウィンドウ・ダイアログ',
    detail: '親ウィンドウを受け取って開く、2つ目以降のウィンドウ',
    rootClass: 'tk.Toplevel',
  },
  { label: '部品（ウィンドウに埋め込む）', kind: vscode.QuickPickItemKind.Separator },
  {
    label: 'ttk.Frame',
    description: 'フレーム',
    detail: '他の画面に配置して使う部品',
    rootClass: 'ttk.Frame',
  },
  {
    label: 'ttk.Labelframe',
    description: '見出し付きのフレーム',
    rootClass: 'ttk.Labelframe',
  },
  { label: 'tk.Frame', description: 'フレーム（classic）', rootClass: 'tk.Frame' },
  {
    label: 'tk.LabelFrame',
    description: '見出し付きのフレーム（classic）',
    rootClass: 'tk.LabelFrame',
  },
];

/**
 * @param target エクスプローラーのコンテキストメニューから呼ばれた場合の、選ばれたフォルダまたはファイル
 */
export async function newScreen(target: vscode.Uri | undefined): Promise<void> {
  const choice = await vscode.window.showQuickPick(ROOT_CHOICES, {
    title: '新しい画面: ルートのクラス（生成されるクラスの基底クラス）',
    placeHolder: '画面の種類を選んでください',
  });
  const rootClass = choice?.rootClass;
  if (!rootClass) return;

  const folder = await targetFolder(target);
  if (!folder) return;

  const suggested =
    rootClass === 'tk.Tk' ? 'main_window' : rootClass === 'tk.Toplevel' ? 'dialog' : 'panel';
  const name = await vscode.window.showInputBox({
    title: `新しい画面（${rootClass}）: 名前`,
    prompt: `${vscode.workspace.asRelativePath(folder)} に <名前>${EXTENSION} を作ります。名前はクラス名・出力するファイル名の既定値にもなります`,
    value: suggested,
    validateInput: async (value) => {
      const trimmed = value.trim().replace(/\.tkui\.json$/, '');
      if (trimmed === '') return '名前を入力してください';
      if (/[\\/:*?"<>|]/.test(trimmed)) return 'ファイル名に使えない文字が含まれています';
      return (await exists(fileUri(folder, trimmed)))
        ? '同じ名前のファイルが既にあります'
        : undefined;
    },
  });
  if (name === undefined) return;
  const baseName = name.trim().replace(/\.tkui\.json$/, '');
  const uri = fileUri(folder, baseName);

  const text = serializeDocument(createDocument(rootClass, baseName));
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(text));
  await vscode.commands.executeCommand('vscode.openWith', uri, DesignerEditorProvider.viewType);
}

/** 作成先のフォルダ。エクスプローラーで選ばれたものを優先し、なければワークスペースのフォルダを使う */
async function targetFolder(target: vscode.Uri | undefined): Promise<vscode.Uri | undefined> {
  if (target) {
    const stat = await vscode.workspace.fs.stat(target);
    return stat.type & vscode.FileType.Directory ? target : vscode.Uri.joinPath(target, '..');
  }
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (folders.length === 1) return folders[0]?.uri;
  if (folders.length > 1) return (await vscode.window.showWorkspaceFolderPick())?.uri;

  // フォルダを開いていなければ、保存先を選んでもらう
  const picked = await vscode.window.showOpenDialog({
    title: '新しい画面を作るフォルダ',
    canSelectFiles: false,
    canSelectFolders: true,
  });
  return picked?.[0];
}

function fileUri(folder: vscode.Uri, baseName: string): vscode.Uri {
  return vscode.Uri.joinPath(folder, `${baseName}${EXTENSION}`);
}

async function exists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}
