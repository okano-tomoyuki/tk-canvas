import { describe, expect, it } from 'vitest';
import { generatePython } from './index.ts';
import { SAMPLE } from './testing.ts';

function generate(existing?: string) {
  const result = generatePython(SAMPLE, 'main_window.tkui.json', existing);
  if (!result.ok) throw new Error(result.error);
  return result;
}

const INITIAL = generate().text;

describe('マーカー区間のマージ', () => {
  it('同じ内容で再生成しても変わらない（冪等）', () => {
    const result = generate(INITIAL);
    expect(result.text).toBe(INITIAL);
    expect(result.modifiedRegions).toEqual([]);
    expect(result.addedStubs).toEqual([]);
  });

  it('区間の外で書いたコード（ハンドラの実装など）は残す', () => {
    const edited = INITIAL.replace(
      '    def on_submit(self):\n        pass',
      '    def on_submit(self):\n        print("submitted", self.user_name.get())',
    ).replace(
      '        self.tkd_bind_events()\n',
      '        self.tkd_bind_events()\n        self.count = 0\n',
    );
    const result = generate(edited);
    expect(result.text).toBe(edited);
    expect(result.modifiedRegions).toEqual([]);
  });

  it('区間内の手編集は上書きし、その区間を知らせる', () => {
    const edited = INITIAL.replace('self.title("Sample")', 'self.title("Edited")');
    const result = generate(edited);
    expect(result.text).toBe(INITIAL);
    expect(result.modifiedRegions).toEqual(['tkd_create_widgets']);
  });

  it('空白・改行の違い（フォーマッタによる整形）は手編集とみなさない', () => {
    const reformatted = INITIAL.replace(
      'self.title("Sample")',
      'self.title(\n            "Sample"\n        )',
    );
    expect(generate(reformatted).modifiedRegions).toEqual([]);
  });

  it('足りないハンドラの雛形だけを handler-stubs マーカーの直後に追記する', () => {
    const withoutStub = INITIAL.replace('\n    def on_submit(self):\n        pass\n', '\n');
    const result = generate(withoutStub);
    expect(result.addedStubs).toEqual(['on_submit']);
    expect(result.text).toContain(
      '    # <tk-designer:handler-stubs>\n\n    def on_submit(self):\n        pass\n',
    );
  });

  it('改行コード（CRLF）を保つ', () => {
    const crlf = INITIAL.replace(/\n/g, '\r\n');
    expect(generate(crlf).text).toBe(crlf);
  });

  const corruptions: [string, (text: string) => string, string][] = [
    [
      '終了マーカーがない',
      (t) => t.replace(/.*<tk-designer:end id="tkd_bind_events".*\n/, ''),
      '終了マーカー',
    ],
    [
      '区間が見つからない',
      (t) => t.replace(/.*<tk-designer:(begin|end) id="tkd_bind_events".*\n/g, ''),
      'tkd_bind_events',
    ],
    [
      '入れ子',
      (t) =>
        t.replace(
          '    # <tk-designer:end id="tkd_create_widgets"',
          '    # <tk-designer:begin id="x">\n    # <tk-designer:end id="tkd_create_widgets"',
        ),
      '閉じる前に',
    ],
  ];

  it.each(corruptions)('マーカーが壊れていれば何も書き込まない: %s', (_, corrupt, message) => {
    const result = generatePython(SAMPLE, 'main_window.tkui.json', corrupt(INITIAL));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain(message);
  });
});
