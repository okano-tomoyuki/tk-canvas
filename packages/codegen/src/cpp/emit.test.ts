import { describe, expect, it } from 'vitest';
import { generateCpp } from '../index.ts';
import { relativePath } from '../names.ts';
import { SAMPLE } from '../testing.ts';

const CPP_SAMPLE = { ...SAMPLE, codegen: { cpp: {} } };

function generate(doc = CPP_SAMPLE, header?: string, source?: string) {
  const result = generateCpp(doc, 'main_window.tkui.json', header, source);
  if ('error' in result) throw new Error(result.error);
  if (!result.header.ok) throw new Error(result.header.error);
  if (!result.source.ok) throw new Error(result.source.error);
  return { header: result.header, source: result.source, warnings: result.warnings };
}

describe('generateCpp', () => {
  it('新規ファイル（ゴールデンファイルと比較）', async () => {
    const { header, source, warnings } = generate();
    expect([header.path, source.path]).toEqual(['main_window.hpp', 'main_window.cpp']);
    expect(warnings).toEqual([]);
    await expect(header.text).toMatchFileSnapshot('../__golden__/main_window.hpp');
    await expect(source.text).toMatchFileSnapshot('../__golden__/main_window.cpp');
  });

  it('Toplevel は親を受け取る', async () => {
    const doc = {
      ...CPP_SAMPLE,
      root: { ...SAMPLE.root, class: 'tk.Toplevel' as const, window: { title: 'Dialog' } },
    };
    const result = generateCpp(doc, 'dialog.tkui.json', undefined, undefined);
    if ('error' in result || !result.header.ok || !result.source.ok) throw new Error('failed');
    await expect(result.header.text).toMatchFileSnapshot('../__golden__/dialog.hpp');
    await expect(result.source.text).toMatchFileSnapshot('../__golden__/dialog.cpp');
  });

  it('Frame をルートにした部品（ゴールデンファイルと比較）', async () => {
    const doc = {
      ...CPP_SAMPLE,
      root: {
        ...SAMPLE.root,
        class: 'ttk.Labelframe' as const,
        window: undefined,
        options: { text: 'Settings', padding: 8 },
        bindings: [{ sequence: '<Configure>', handler: 'on_resize' }],
      },
    };
    const result = generateCpp(doc, 'settings_panel.tkui.json', undefined, undefined);
    if ('error' in result || !result.header.ok || !result.source.ok) throw new Error('failed');
    await expect(result.header.text).toMatchFileSnapshot('../__golden__/settings_panel.hpp');
    await expect(result.source.text).toMatchFileSnapshot('../__golden__/settings_panel.cpp');
  });

  it('既存のヘッダの基底クラスがルートと違えば書き込まない', () => {
    const initial = generate();
    const doc = {
      ...CPP_SAMPLE,
      root: { ...SAMPLE.root, class: 'tk.Frame' as const, window: undefined },
    };
    const result = generateCpp(
      doc,
      'main_window.tkui.json',
      initial.header.text,
      initial.source.text,
    );
    if ('error' in result) throw new Error(result.error);
    expect(result.header.ok).toBe(false);
    expect(!result.header.ok && result.header.error).toContain(
      '基底クラスが cpp_tk::Tk ですが、DSL のルートは cpp_tk::Frame です',
    );
  });

  it('再生成しても変わらず、ソースの区間外のコードは残す', () => {
    const initial = generate();
    const edited = initial.source.text.replace(
      'void MainWindow::on_submit()\n{\n    // TODO: 実装\n}',
      'void MainWindow::on_submit()\n{\n    submit_count_++;\n}',
    );
    const again = generate(CPP_SAMPLE, initial.header.text, edited);
    expect(again.header.text).toBe(initial.header.text);
    expect(again.source.text).toBe(edited);
  });

  it('足りないハンドラだけを雛形として追記し、宣言はヘッダの区間に入る', () => {
    const initial = generate();
    const doc = {
      ...CPP_SAMPLE,
      root: {
        ...SAMPLE.root,
        bindings: [{ sequence: '<Configure>', handler: 'on_resize' }],
      },
    };
    const again = generate(doc, initial.header.text, initial.source.text);
    expect(again.source.addedStubs).toEqual(['on_resize']);
    expect(again.header.text).toContain('    void on_resize(const cpp_tk::Event& event);');
    expect(again.source.text).toContain('void MainWindow::on_resize(const tk::Event& event)');
  });

  it('ルートの生成時にしか指定できないオプションは警告する', () => {
    const doc = { ...CPP_SAMPLE, root: { ...SAMPLE.root, options: { class: 'MyApp' } } };
    expect(generate(doc).warnings).toEqual([
      'main_window: class は生成時にしか指定できないため、生成したコードには反映されません（生成したクラスのコンストラクタ引数で指定してください）',
    ]);
  });
});

describe('relativePath', () => {
  it.each([
    ['main_window.cpp', 'main_window.hpp', 'main_window.hpp'],
    ['src/main_window.cpp', 'include/main_window.hpp', '../include/main_window.hpp'],
    ['src/ui/a.cpp', 'src/ui/a.hpp', 'a.hpp'],
  ])('%s から %s', (from, to, expected) => {
    expect(relativePath(from, to)).toBe(expected);
  });
});
