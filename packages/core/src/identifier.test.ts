import { describe, expect, it } from 'vitest';
import { isValidIdentifier } from './identifier.ts';

describe('isValidIdentifier', () => {
  it.each(['name_entry', 'submitButton', '_private', 'x1'])('%s は有効', (id) => {
    expect(isValidIdentifier(id)).toBeNull();
  });

  it.each([
    ['', 'empty'],
    ['1st', 'invalid-characters'],
    ['name-entry', 'invalid-characters'],
    ['名前', 'invalid-characters'],
    ['class', 'cpp-keyword'],
    ['new', 'cpp-keyword'],
    ['lambda', 'python-keyword'],
    ['None', 'python-keyword'],
    ['tkd_create_widgets', 'reserved-prefix'],
    ['my__entry', 'cpp-reserved'],
    ['_Entry', 'cpp-reserved'],
  ] as const)('%s は %s', (id, problem) => {
    expect(isValidIdentifier(id)).toBe(problem);
  });
});
