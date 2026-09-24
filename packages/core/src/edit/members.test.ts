import { describe, expect, it } from 'vitest';
import type { TkuiDocument } from '../dsl/schema.ts';
import { collectHandlers, countVariableReferences, sequenceToName } from './members.ts';

const DOC: TkuiDocument = {
  formatVersion: 1,
  variables: { level: { type: 'DoubleVar' }, unused: { type: 'StringVar' } },
  root: {
    id: 'root',
    class: 'tk.Tk',
    layout: { manager: 'pack' },
    children: [
      {
        id: 'ok',
        class: 'ttk.Button',
        options: { command: { handler: 'on_ok' } },
        bindings: [{ sequence: '<Return>', handler: 'on_ok' }],
      },
      {
        id: 'scale',
        class: 'ttk.Scale',
        options: { variable: { var: 'level' }, command: { handler: 'on_level' } },
      },
    ],
  },
};

describe('collectHandlers', () => {
  it('参照数とシグネチャを集める', () => {
    expect(collectHandlers(DOC)).toEqual([
      { name: 'on_ok', count: 2, signatures: ['none', 'event'] },
      { name: 'on_level', count: 1, signatures: ['value'] },
    ]);
  });
});

describe('countVariableReferences', () => {
  it('変数ごとの参照数', () => {
    expect([...countVariableReferences(DOC)]).toEqual([['level', 1]]);
  });
});

describe('sequenceToName', () => {
  it.each([
    ['<Return>', 'return'],
    ['<<ComboboxSelected>>', 'comboboxselected'],
    ['<Double-Button-1>', 'double_button_1'],
    ['<>', 'event'],
  ])('%s → %s', (sequence, name) => {
    expect(sequenceToName(sequence)).toBe(name);
  });
});
