import { describe, expect, it } from 'vitest';
import { findOption, getWidgetCatalog } from './catalog.ts';
import { inferOptionType, parseEnumValues, type RawOption } from './infer.ts';
import { CLASS_OVERLAYS } from './overlay.ts';

const catalog = getWidgetCatalog();

function classInfo(name: string) {
  const info = catalog.classes.get(name);
  if (!info) throw new Error(`${name} がカタログにありません`);
  return info;
}

function optionType(className: string, option: string) {
  return classInfo(className).options.get(option)?.type;
}

describe('parseEnumValues', () => {
  it.each([
    [
      'bad relief "x": must be flat, groove, raised, ridge, solid, or sunken',
      ['flat', 'groove', 'raised', 'ridge', 'solid', 'sunken'],
    ],
    ['bad orient "x": must be horizontal or vertical', ['horizontal', 'vertical']],
    ['bad screen distance "x"', undefined],
  ])('%s', (message, expected) => {
    expect(parseEnumValues(message)).toEqual(expected);
  });
});

describe('inferOptionType', () => {
  const base: RawOption = {
    name: 'x',
    dbName: 'x',
    dbClass: 'X',
    default: '',
    creationOnly: false,
    probeError: '',
  };

  it.each([
    [{ probeError: 'unknown color name "x"' }, { kind: 'color' }],
    [{ probeError: 'expected integer but got "x"' }, { kind: 'integer' }],
    [{ dbClass: 'Font' }, { kind: 'font' }],
    [{ dbClass: 'ScrollCommand' }, { kind: 'callback' }],
    [{ probeError: 'bad scrollRegion "x"' }, { kind: 'string' }],
    [{}, { kind: 'string' }],
  ])('%o → %o', (raw, expected) => {
    expect(inferOptionType({ ...base, ...raw })).toEqual(expected);
  });
});

describe('ウィジェットカタログ', () => {
  it('cpp_tk がカバーする 37 クラスを含む', () => {
    expect(catalog.classes.size).toBe(37);
  });

  it('オーバーレイが参照するクラス・オプションはすべて存在する（綴り誤りの検出）', () => {
    for (const [className, overlay] of Object.entries(CLASS_OVERLAYS)) {
      const info = classInfo(className);
      for (const option of [
        ...(overlay.commonOptions ?? []),
        ...Object.keys(overlay.optionTypes ?? {}),
      ]) {
        expect(info.options.has(option), `${className}.${option}`).toBe(true);
      }
    }
  });

  it('自動推定: 列挙値・生成時のみのオプション・別名', () => {
    expect(optionType('tk.Button', 'relief')).toEqual({
      kind: 'enum',
      values: ['flat', 'groove', 'raised', 'ridge', 'solid', 'sunken'],
    });
    expect(classInfo('tk.Frame').options.get('class')?.creationOnly).toBe(true);
    expect(findOption(classInfo('tk.Button'), 'bd')).toMatchObject({
      option: { name: 'borderwidth' },
      isAlias: true,
    });
  });

  it('オーバーレイ: command のシグネチャ・変数型・子の置き方', () => {
    expect(optionType('ttk.Button', 'command')).toEqual({ kind: 'callback', signature: 'none' });
    expect(optionType('ttk.Scale', 'command')).toEqual({ kind: 'callback', signature: 'value' });
    expect(optionType('ttk.Entry', 'textvariable')).toEqual({
      kind: 'variable',
      variableTypes: ['StringVar'],
    });
    expect(classInfo('ttk.Notebook').children).toBe('notebook');
    expect(classInfo('ttk.Button').children).toBeUndefined();
  });

  it('オーバーレイ未整備のクラスも抽出結果だけで使える', () => {
    const info = classInfo('tk.Message');
    expect(info.curated).toBe(false);
    expect(info.category).toBe('other');
    expect(info.options.has('text')).toBe(true);
  });
});
