/**
 * プロパティエディタの入力文字列と DSL の値の相互変換。
 * 空欄は「値を書かない（Tk の既定値）」を表し、value: undefined を返す。
 */
import type { OptionType } from '../catalog/types.ts';
import type { LiteralValue, OptionValue } from '../dsl/schema.ts';

export type InputResult<T> =
  | { readonly ok: true; readonly value: T | undefined }
  | { readonly ok: false; readonly error: string };

const EMPTY = { ok: true, value: undefined } as const;
const INTEGER = /^-?\d+$/;
const NUMBER = /^-?(\d+(\.\d*)?|\.\d+)$/;
const DISTANCE_WITH_UNIT = /^-?\d+(\.\d+)?[cimp]$/;

export function parseInteger(text: string): InputResult<number> {
  const t = text.trim();
  if (t === '') return EMPTY;
  return INTEGER.test(t)
    ? { ok: true, value: Number(t) }
    : { ok: false, error: '整数で入力してください' };
}

export function parseNumber(text: string): InputResult<number> {
  const t = text.trim();
  if (t === '') return EMPTY;
  return NUMBER.test(t)
    ? { ok: true, value: Number(t) }
    : { ok: false, error: '数値で入力してください' };
}

/** padx / pady: "4"（両側）または "4 8"（前, 後） */
export function parsePad(text: string): InputResult<number | [number, number]> {
  const parts = text
    .trim()
    .split(/\s+/)
    .filter((p) => p !== '');
  if (parts.length === 0) return EMPTY;
  if (parts.length <= 2 && parts.every((p) => NUMBER.test(p) && Number(p) >= 0)) {
    const [a = 0, b = a] = parts.map(Number);
    return { ok: true, value: parts.length === 1 ? a : [a, b] };
  }
  return { ok: false, error: '"4" または "4 8"（前, 後）の形式で、0 以上の数値を入力してください' };
}

/** 空白区切りの数値の組（minsize の "幅 高さ"、タブの padding など） */
export function parseNumberList(text: string, counts: readonly number[]): InputResult<number[]> {
  const parts = text
    .trim()
    .split(/\s+/)
    .filter((p) => p !== '');
  if (parts.length === 0) return EMPTY;
  if (counts.includes(parts.length) && parts.every((p) => NUMBER.test(p))) {
    return { ok: true, value: parts.map(Number) };
  }
  return { ok: false, error: `${counts.join(' / ')} 個の数値を空白区切りで入力してください` };
}

/** オプションの入力文字列を、カタログの型に従って DSL の値にする（変数・ハンドラ参照は専用の入力欄で扱う） */
export function parseOptionInput(type: OptionType, text: string): InputResult<OptionValue> {
  const t = text.trim();
  if (t === '') return EMPTY;
  switch (type.kind) {
    case 'integer':
      return parseInteger(t);
    case 'number':
      return parseNumber(t);
    case 'distance':
      if (NUMBER.test(t)) return { ok: true, value: Number(t) };
      if (DISTANCE_WITH_UNIT.test(t)) return { ok: true, value: t };
      return {
        ok: false,
        error: '数値（ピクセル）、または "2c" "10p" のような単位つきで入力してください',
      };
    case 'boolean':
      if (['true', '1', 'yes', 'on'].includes(t.toLowerCase())) return { ok: true, value: true };
      if (['false', '0', 'no', 'off'].includes(t.toLowerCase())) return { ok: true, value: false };
      return { ok: false, error: 'true / false を指定してください' };
    case 'enum':
      return type.values.includes(t)
        ? { ok: true, value: t }
        : { ok: false, error: `${type.values.join(', ')} のいずれかを指定してください` };
    case 'variable':
    case 'callback':
      return { ok: false, error: 'このオプションは参照で指定します' };
    case 'string':
      // 表示文字列などは前後の空白も意味を持つため、そのまま使う
      return { ok: true, value: text };
    default:
      return { ok: true, value: t };
  }
}

/** DSL の値を入力欄に表示する文字列にする（参照は空文字） */
export function formatValue(value: OptionValue | LiteralValue | undefined): string {
  if (value === undefined) return '';
  if (Array.isArray(value)) {
    return (value as readonly LiteralValue[])
      .map((v) => (Array.isArray(v) ? `{${formatValue(v)}}` : formatValue(v)))
      .join(' ');
  }
  if (typeof value === 'object') return '';
  return String(value);
}
