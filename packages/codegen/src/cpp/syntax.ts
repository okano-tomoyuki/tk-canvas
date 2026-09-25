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
    // ヘッダの `class Name : public Base` から基底クラスを取り出す（ソースにはクラスの宣言がない）
    baseClassesOf: (text, name) => {
      const match = new RegExp(`\\bclass\\s+${name}\\b(?:\\s+final)?\\s*:([^{;]*)\\{`).exec(text);
      if (!match) return undefined;
      return (match[1] ?? '')
        .split(',')
        .map((b) => b.replace(/\b(public|protected|private|virtual)\b/g, '').replace(/\s+/g, ''))
        .filter((b) => b.length > 0);
    },
  };
}
