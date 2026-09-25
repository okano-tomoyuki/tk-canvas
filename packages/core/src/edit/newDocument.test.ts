import { describe, expect, it } from 'vitest';
import { parseDocument } from '../dsl/parse.ts';
import { ROOT_CLASSES } from '../dsl/schema.ts';
import { serializeDocument } from '../dsl/serialize.ts';
import { createDocument } from './newDocument.ts';

describe('createDocument', () => {
  it.each(ROOT_CLASSES)('%s をルートにした新しい画面は検証を通る', (rootClass) => {
    const text = serializeDocument(createDocument(rootClass, 'main_window'));
    expect(parseDocument(text).diagnostics).toEqual([]);
  });

  it('ウィンドウのときだけタイトルを入れる', () => {
    expect(createDocument('tk.Tk', 'main_window').root.window).toEqual({ title: 'main_window' });
    expect(createDocument('ttk.Frame', 'panel').root.window).toBeUndefined();
  });

  it('名前を識別子にしてルートの id にする', () => {
    expect(createDocument('tk.Tk', 'login-dialog').root.id).toBe('login_dialog');
    expect(createDocument('tk.Tk', '2nd').root.id).toBe('_2nd');
    expect(createDocument('tk.Tk', 'class').root.id).toBe('root');
  });
});
