/**
 * DSL の id は生成コードのメンバ名になるため、C++ と Python の両方で識別子として使えなければならない。
 */
import { CPP_BASE_MEMBERS, PYTHON_BASE_MEMBERS } from './baseMembers.ts';

const CPP_KEYWORDS: ReadonlySet<string> = new Set([
  'alignas',
  'alignof',
  'and',
  'and_eq',
  'asm',
  'auto',
  'bitand',
  'bitor',
  'bool',
  'break',
  'case',
  'catch',
  'char',
  'char8_t',
  'char16_t',
  'char32_t',
  'class',
  'compl',
  'concept',
  'const',
  'consteval',
  'constexpr',
  'constinit',
  'const_cast',
  'continue',
  'co_await',
  'co_return',
  'co_yield',
  'decltype',
  'default',
  'delete',
  'do',
  'double',
  'dynamic_cast',
  'else',
  'enum',
  'explicit',
  'export',
  'extern',
  'false',
  'float',
  'for',
  'friend',
  'goto',
  'if',
  'inline',
  'int',
  'long',
  'mutable',
  'namespace',
  'new',
  'noexcept',
  'not',
  'not_eq',
  'nullptr',
  'operator',
  'or',
  'or_eq',
  'private',
  'protected',
  'public',
  'register',
  'reinterpret_cast',
  'requires',
  'return',
  'short',
  'signed',
  'sizeof',
  'static',
  'static_assert',
  'static_cast',
  'struct',
  'switch',
  'template',
  'this',
  'thread_local',
  'throw',
  'true',
  'try',
  'typedef',
  'typeid',
  'typename',
  'union',
  'unsigned',
  'using',
  'virtual',
  'void',
  'volatile',
  'wchar_t',
  'while',
  'xor',
  'xor_eq',
]);

const PYTHON_KEYWORDS: ReadonlySet<string> = new Set([
  'False',
  'None',
  'True',
  'and',
  'as',
  'assert',
  'async',
  'await',
  'break',
  'class',
  'continue',
  'def',
  'del',
  'elif',
  'else',
  'except',
  'finally',
  'for',
  'from',
  'global',
  'if',
  'import',
  'in',
  'is',
  'lambda',
  'nonlocal',
  'not',
  'or',
  'pass',
  'raise',
  'return',
  'try',
  'while',
  'with',
  'yield',
]);

/** 予約メソッドの接頭辞（docs/codegen-design.md M6）。ユーザー定義の id には使わせない。 */
const RESERVED_PREFIX = 'tkd_';

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export type IdentifierProblem =
  | 'empty'
  | 'invalid-characters'
  | 'cpp-keyword'
  | 'python-keyword'
  | 'reserved-prefix'
  | 'cpp-reserved';

/**
 * id が C++ / Python 双方の識別子として使えるかを判定する。
 * @returns 問題がなければ null、あれば最初に見つかった問題
 */
export function isValidIdentifier(id: string): IdentifierProblem | null {
  if (id.length === 0) return 'empty';
  // 非 ASCII は C++ / Python で扱いが異なるため ASCII に限定する
  if (!IDENTIFIER_PATTERN.test(id)) return 'invalid-characters';
  if (CPP_KEYWORDS.has(id)) return 'cpp-keyword';
  if (PYTHON_KEYWORDS.has(id)) return 'python-keyword';
  if (id.startsWith(RESERVED_PREFIX)) return 'reserved-prefix';
  // C++ では "__" を含む名前と "_大文字" で始まる名前は処理系予約
  if (id.includes('__') || /^_[A-Z]/.test(id)) return 'cpp-reserved';
  return null;
}

const IDENTIFIER_PROBLEM_MESSAGES: Readonly<Record<IdentifierProblem, string>> = {
  empty: '空にはできません',
  'invalid-characters': '英字・数字・_ のみ使用でき、数字で始めることはできません',
  'cpp-keyword': 'C++ のキーワードは使用できません',
  'python-keyword': 'Python のキーワードは使用できません',
  'reserved-prefix': '"tkd_" で始まる名前は予約されています',
  'cpp-reserved': '"__" を含む名前と "_" + 大文字で始まる名前は C++ で予約されています',
};

export function describeIdentifierProblem(problem: IdentifierProblem): string {
  return IDENTIFIER_PROBLEM_MESSAGES[problem];
}

/** 生成クラスの基底クラス（Tk・Frame など）のメンバと同じ名前か（docs/adr/0011） */
export function isBaseMemberName(name: string): boolean {
  return PYTHON_BASE_MEMBERS.has(name) || CPP_BASE_MEMBERS.has(name);
}

/**
 * 生成クラスのメンバ（ウィジェット・変数・ハンドラ）の名前として使えるかを判定する。
 * @returns 問題がなければ null、あれば利用者向けの説明
 */
export function memberNameProblem(name: string): string | null {
  const problem = isValidIdentifier(name);
  if (problem) return IDENTIFIER_PROBLEM_MESSAGES[problem];
  if (isBaseMemberName(name))
    return '生成されるクラスの基底クラス（Tk・Frame など）のメンバと同じ名前は使用できません';
  return null;
}
