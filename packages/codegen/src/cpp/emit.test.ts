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

  it('Toplevel は親を受け取り、run を持たない', async () => {
    const doc = {
      ...CPP_SAMPLE,
      root: { ...SAMPLE.root, class: 'tk.Toplevel' as const, window: { title: 'Dialog' } },
    };
    const result = generateCpp(doc, 'dialog.tkui.json', undefined, undefined);
    if ('error' in result || !result.header.ok || !result.source.ok) throw new Error('failed');
    await expect(result.header.text).toMatchFileSnapshot('../__golden__/dialog.hpp');
    await expect(result.source.text).toMatchFileSnapshot('../__golden__/dialog.cpp');
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

  it('tk.Tk の生成時にしか指定できないオプションは警告する', () => {
    const doc = { ...CPP_SAMPLE, root: { ...SAMPLE.root, options: { class: 'MyApp' } } };
    expect(generate(doc).warnings).toEqual([
      'main_window: class は tk.Tk の生成時にしか指定できないため、C++ では反映されません',
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
