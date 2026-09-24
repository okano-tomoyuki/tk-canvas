/**
 * 拡張ホストと Webview の間で交わすメッセージの型（docs/adr/0006）。
 * 両者はこの型を介してのみ通信し、互いのコードを直接 import しない。
 */
import type { EditCommand } from './edit/commands.ts';

export type ExtensionToWebviewMessage =
  /** TextDocument の現在の内容。変更のたびに送る（テキストエディタでの編集や Undo/Redo を含む） */
  | { readonly type: 'document'; readonly version: number; readonly text: string }
  /** edit の処理結果。document の送信より後に届く */
  | {
      readonly type: 'editResult';
      readonly requestId: number;
      readonly ok: boolean;
      readonly error?: string;
    };

export type WebviewToExtensionMessage =
  | { readonly type: 'ready' }
  | { readonly type: 'edit'; readonly requestId: number; readonly command: EditCommand };
