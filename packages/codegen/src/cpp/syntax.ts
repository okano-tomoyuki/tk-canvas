import type { LanguageSyntax } from '../region.ts';

/** C++ のソースの規則。ハンドラが定義済みかは `クラス名::ハンドラ名(` の有無で判定する */
export function cppSyntax(className: string): LanguageSyntax {
  return {
    comment: '//',
    indentUnit: '    ',
    // className とハンドラ名は識別子の検証を通っているため、正規表現の特殊文字を含まない
    hasHandler: (text, name) => new RegExp(`\\b${className}::${name}\\s*\\(`).test(text),
    // stubs マーカーがなければ末尾に追記する
    fallbackStubLine: (lines) => (lines[lines.length - 1] === '' ? lines.length - 1 : lines.length),
  };
}
