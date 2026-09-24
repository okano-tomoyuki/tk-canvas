import type { LanguageSyntax } from '../region.ts';

export const PYTHON_SYNTAX: LanguageSyntax = {
  comment: '#',
  indentUnit: '    ',
  // name は識別子の検証を通っているため、正規表現の特殊文字を含まない
  hasHandler: (text, name) => new RegExp(`^\\s*def\\s+${name}\\s*\\(`, 'm').test(text),
  // stubs マーカーがなければ、`if __name__ == "__main__":` の手前（なければ末尾）に追記する
  fallbackStubLine: (lines) => {
    const main = lines.findIndex((l) => /^if __name__ == ["']__main__["']:/.test(l));
    if (main < 0) return lines.length;
    // 直前の空行の前に入れる
    let at = main;
    while (at > 0 && lines[at - 1]?.trim() === '') at--;
    return at;
  },
};
