/**
 * 抽出結果（tools/catalog/extract.tcl）から、オプション値の型を推定する。
 * 主な手がかりは、不正な値を設定したときの Tk のエラーメッセージ。
 * エラーにならなかった（何でも受け付ける）オプションは、データベースクラス名で分類する。
 */
import type { VariableType } from '../dsl/schema.ts';
import type { OptionType } from './types.ts';

export interface RawOption {
  readonly name: string;
  readonly dbName: string;
  readonly dbClass: string;
  readonly default: string;
  readonly creationOnly: boolean;
  readonly creationError?: string;
  readonly probeError: string;
}

const ALL_VARIABLE_TYPES: readonly VariableType[] = [
  'StringVar',
  'IntVar',
  'DoubleVar',
  'BooleanVar',
];

/** エラーメッセージの先頭一致 → 型 */
const MESSAGE_RULES: readonly (readonly [RegExp, OptionType])[] = [
  [/^unknown color name /, { kind: 'color' }],
  [/^bad screen distance /, { kind: 'distance' }],
  [/^expected integer but got /, { kind: 'integer' }],
  [/^expected floating-point number but got /, { kind: 'number' }],
  [/^expected boolean value but got /, { kind: 'boolean' }],
  [/^bad cursor spec /, { kind: 'cursor' }],
  [/^image ".*" doesn't exist$/, { kind: 'image' }],
  [/^bitmap ".*" not defined$/, { kind: 'bitmap' }],
  [/^Layout .* not found$/, { kind: 'style' }],
  [/^bad window path name /, { kind: 'window' }],
];

/** 例: bad relief "x": must be flat, groove, raised, ridge, solid, or sunken */
const ENUM_MESSAGE = /^bad [\w ]+ ".*": must be (.+)$/;

export function inferOptionType(option: RawOption): OptionType {
  const message = option.probeError;

  if (message === '') return inferFromDbClass(option);

  for (const [pattern, type] of MESSAGE_RULES) {
    if (pattern.test(message)) return type;
  }
  const values = parseEnumValues(message);
  if (values) return { kind: 'enum', values };

  // 形式が独特なもの（scrollregion、format 等）は文字列として扱い、必要ならオーバーレイで補正する
  return { kind: 'string' };
}

function inferFromDbClass(option: RawOption): OptionType {
  switch (option.dbClass) {
    case 'Font':
      return { kind: 'font' };
    case 'Variable':
      return { kind: 'variable', variableTypes: ALL_VARIABLE_TYPES };
    default:
      // Command, ScrollCommand, ValidateCommand, PostCommand 等
      if (option.dbClass.endsWith('Command')) return { kind: 'callback' };
      return { kind: 'string' };
  }
}

/** "a, b, or c" / "a or b" を分解する。列挙の形式でなければ undefined */
export function parseEnumValues(message: string): readonly string[] | undefined {
  const match = ENUM_MESSAGE.exec(message);
  const list = match?.[1];
  if (list === undefined) return undefined;
  const values = list
    .replace(/,? or /, ', ')
    .split(', ')
    .map((v) => v.trim());
  return values.every((v) => /^[\w-]+$/.test(v)) ? values : undefined;
}
