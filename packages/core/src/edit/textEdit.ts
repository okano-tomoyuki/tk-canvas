export interface TextEdit {
  /** 置き換える範囲の開始位置（文字オフセット） */
  readonly start: number;
  /** 置き換える範囲の終了位置（文字オフセット、この位置は含まない） */
  readonly end: number;
  readonly text: string;
}

/**
 * oldText を newText にするための最小の置き換えを求める（共通の先頭・末尾を除いた中間部分だけを置き換える）。
 * 文書全体を置き換えるより、テキストエディタで同時に開いているときのカーソル位置や差分表示への影響が小さい。
 * 変更がなければ undefined。
 */
export function minimalTextEdit(oldText: string, newText: string): TextEdit | undefined {
  if (oldText === newText) return undefined;

  let prefix = 0;
  const maxPrefix = Math.min(oldText.length, newText.length);
  while (prefix < maxPrefix && oldText.charCodeAt(prefix) === newText.charCodeAt(prefix)) prefix++;

  let suffix = 0;
  const maxSuffix = maxPrefix - prefix;
  while (
    suffix < maxSuffix &&
    oldText.charCodeAt(oldText.length - 1 - suffix) ===
      newText.charCodeAt(newText.length - 1 - suffix)
  ) {
    suffix++;
  }

  // サロゲートペアの途中で切らないよう、境界を調整する
  if (prefix > 0 && isLowSurrogate(newText.charCodeAt(prefix))) prefix--;
  if (suffix > 0 && isLowSurrogate(newText.charCodeAt(newText.length - suffix))) suffix--;

  return {
    start: prefix,
    end: oldText.length - suffix,
    text: newText.slice(prefix, newText.length - suffix),
  };
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}
