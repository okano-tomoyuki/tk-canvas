import { describe, expect, it } from 'vitest';
import type { OptionType } from '../catalog/types.ts';
import { formatValue, parseNumberList, parseOptionInput, parsePad } from './inputs.ts';

describe('parseOptionInput', () => {
  const enumType: OptionType = { kind: 'enum', values: ['flat', 'raised'] };
  it.each([
    [{ kind: 'integer' }, '10', 10],
    [{ kind: 'number' }, '0.5', 0.5],
    [{ kind: 'distance' }, '12', 12],
    [{ kind: 'distance' }, '2c', '2c'],
    [{ kind: 'boolean' }, 'true', true],
    [enumType, 'raised', 'raised'],
    [{ kind: 'string' }, ' Hello ', ' Hello '],
    [{ kind: 'color' }, ' red ', 'red'],
  ] as const)('%o に %s → %o', (type, text, value) => {
    expect(parseOptionInput(type, text)).toEqual({ ok: true, value });
  });

  it('空欄は値を書かない（Tk の既定値）', () => {
    expect(parseOptionInput({ kind: 'string' }, '  ')).toEqual({ ok: true, value: undefined });
  });

  it.each([
    [{ kind: 'integer' }, '1.5'],
    [{ kind: 'distance' }, 'wide'],
    [enumType, 'bumpy'],
    [{ kind: 'callback' }, 'on_click'],
  ] as const)('%o に %s はエラー', (type, text) => {
    expect(parseOptionInput(type, text).ok).toBe(false);
  });
});

describe('parsePad / parseNumberList', () => {
  it('pad は1値または2値', () => {
    expect(parsePad('4')).toEqual({ ok: true, value: 4 });
    expect(parsePad(' 4  8 ')).toEqual({ ok: true, value: [4, 8] });
    expect(parsePad('1 2 3').ok).toBe(false);
    expect(parsePad('-1').ok).toBe(false);
  });

  it('数値の組', () => {
    expect(parseNumberList('300 200', [2])).toEqual({ ok: true, value: [300, 200] });
    expect(parseNumberList('1 2 3', [1, 2, 4]).ok).toBe(false);
  });
});

describe('formatValue', () => {
  it('配列は空白区切り、入れ子は波括弧で囲む', () => {
    expect(formatValue(['Arial', 12, 'bold'])).toBe('Arial 12 bold');
    expect(formatValue([['a b'], 'c'])).toBe('{a b} c');
    expect(formatValue({ var: 'x' })).toBe('');
    expect(formatValue(undefined)).toBe('');
  });
});
