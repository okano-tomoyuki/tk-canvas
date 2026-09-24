import { describe, expect, it } from 'vitest';
import { minimalTextEdit, type TextEdit } from './textEdit.ts';

function applyEdit(text: string, edit: TextEdit | undefined): string {
  return edit ? text.slice(0, edit.start) + edit.text + text.slice(edit.end) : text;
}

describe('minimalTextEdit', () => {
  it.each([
    ['abcdef', 'abXYef', { start: 2, end: 4, text: 'XY' }],
    ['abc', 'abcd', { start: 3, end: 3, text: 'd' }],
    ['abcd', 'abc', { start: 3, end: 4, text: '' }],
    ['aaa', 'aaaa', { start: 3, end: 3, text: 'a' }],
  ])('%s → %s', (before, after, expected) => {
    const edit = minimalTextEdit(before, after);
    expect(edit).toEqual(expected);
    expect(applyEdit(before, edit)).toBe(after);
  });

  it('変更がなければ undefined', () => {
    expect(minimalTextEdit('same', 'same')).toBeUndefined();
  });

  it('サロゲートペアを途中で切らない', () => {
    const before = 'a😀b';
    const after = 'a😁b';
    const edit = minimalTextEdit(before, after);
    expect(edit?.text).toBe('😁');
    expect(applyEdit(before, edit)).toBe(after);
  });
});
