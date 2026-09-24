import type { OptionType } from '../catalog/types.ts';
import type { OptionValue } from './schema.ts';

const DISTANCE = /^-?\d+(\.\d+)?[cimp]?$/;

/**
 * リテラル値がオプションの型に合うかを判定する。
 * @returns 合わない場合は理由、合う場合は undefined
 */
export function checkLiteralValue(type: OptionType, value: OptionValue): string | undefined {
  switch (type.kind) {
    case 'integer':
      return Number.isInteger(value) ? undefined : '整数で指定する必要があります';
    case 'number':
      return typeof value === 'number' ? undefined : '数値で指定する必要があります';
    case 'boolean':
      return typeof value === 'boolean' ? undefined : 'true / false で指定する必要があります';
    case 'distance':
      return typeof value === 'number' || (typeof value === 'string' && DISTANCE.test(value))
        ? undefined
        : '数値（ピクセル）、または "2c" "10p" のような単位つきの文字列で指定する必要があります';
    case 'enum':
      return typeof value === 'string' && type.values.includes(value)
        ? undefined
        : `${type.values.map((v) => `"${v}"`).join(', ')} のいずれかを指定する必要があります`;
    case 'list':
      return Array.isArray(value) || typeof value === 'string'
        ? undefined
        : '配列、または空白区切りの文字列で指定する必要があります';
    case 'font':
      return Array.isArray(value) || typeof value === 'string'
        ? undefined
        : '"Arial 12 bold" のような文字列、または ["Arial", 12, "bold"] のような配列で指定する必要があります';
    case 'color':
    case 'image':
    case 'bitmap':
    case 'cursor':
    case 'style':
    case 'window':
      return typeof value === 'string' ? undefined : '文字列で指定する必要があります';
    case 'string':
      return undefined;
    case 'variable':
    case 'callback':
      // 参照が必須のオプションは呼び出し側で扱う
      return undefined;
  }
}
