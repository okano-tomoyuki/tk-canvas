import type { Diagnostic, JsonPath } from '@tk-designer/core';

/**
 * 診断のうち、path が prefix で始まるもののメッセージをまとめる（該当する欄にエラーを表示するため）。
 * exact が true なら、path が prefix と一致するものだけを対象にする。
 */
export function messagesAt(
  diagnostics: readonly Diagnostic[],
  prefix: JsonPath | undefined,
  exact = false,
): string | undefined {
  if (!prefix) return undefined;
  const messages = diagnostics
    .filter((d) => (exact ? d.path.length === prefix.length : d.path.length >= prefix.length))
    .filter((d) => prefix.every((key, i) => d.path[i] === key))
    .map((d) => d.message);
  return messages.length > 0 ? messages.join(' / ') : undefined;
}
