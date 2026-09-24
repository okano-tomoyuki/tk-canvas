import { parseDocument } from '@tk-designer/core';
import { describe, expect, it } from 'vitest';
import { generatePython } from '../index.ts';
import { SAMPLE } from '../testing.ts';

describe('generatePython', () => {
  it('サンプルは検証を通る（前提）', () => {
    expect(parseDocument(JSON.stringify(SAMPLE)).diagnostics).toEqual([]);
  });

  it('新規ファイル（ゴールデンファイルと比較）', async () => {
    const result = generatePython(SAMPLE, 'main_window.tkui.json', undefined);
    if (!result.ok) throw new Error(result.error);
    expect(result.path).toBe('main_window.py');
    await expect(result.text).toMatchFileSnapshot('../__golden__/main_window.py');
  });

  it('Toplevel は master を受け取り、run と __main__ を持たない', async () => {
    const doc = {
      ...SAMPLE,
      root: { ...SAMPLE.root, class: 'tk.Toplevel' as const, window: { title: 'Dialog' } },
    };
    const result = generatePython(doc, 'dialog.tkui.json', undefined);
    if (!result.ok) throw new Error(result.error);
    await expect(result.text).toMatchFileSnapshot('../__golden__/dialog.py');
  });

  it('codegen.python がなければ生成しない', () => {
    expect(generatePython({ ...SAMPLE, codegen: {} }, 'main_window.tkui.json', undefined).ok).toBe(
      false,
    );
  });

  it('クラス名・出力先を指定できる', () => {
    const doc = {
      ...SAMPLE,
      codegen: { python: { className: 'LoginDialog', file: 'ui/login.py' } },
    };
    const result = generatePython(doc, 'main_window.tkui.json', undefined);
    expect(result.ok && result.path).toBe('ui/login.py');
    expect(result.ok && result.text).toContain('class LoginDialog:');
  });
});
