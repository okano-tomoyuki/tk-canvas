import raw from './tk-raw.json' with { type: 'json' };
import { inferOptionType, type RawOption } from './infer.ts';
import {
  CLASS_OVERLAYS,
  COMMON_EVENTS,
  GENERIC_OPTION_TYPES,
  type ClassOverlay,
} from './overlay.ts';
import type { OptionInfo, WidgetCatalog, WidgetClassInfo } from './types.ts';

/** tools/catalog/extract.tcl の出力形式 */
export interface RawCatalog {
  readonly tkVersion: string;
  readonly windowingSystem: string;
  readonly classes: Readonly<
    Record<
      string,
      {
        readonly tclCommand: string;
        readonly aliases: Readonly<Record<string, string>>;
        readonly options: readonly RawOption[];
      }
    >
  >;
}

const rawCatalog: RawCatalog = raw;

export function buildCatalog(
  source: RawCatalog,
  overlays: Readonly<Record<string, ClassOverlay>>,
): WidgetCatalog {
  const classes = new Map<string, WidgetClassInfo>();
  for (const [name, rawClass] of Object.entries(source.classes)) {
    const overlay = overlays[name];
    const options = new Map<string, OptionInfo>(
      rawClass.options.map((option) => [
        option.name,
        {
          name: option.name,
          dbName: option.dbName,
          dbClass: option.dbClass,
          default: option.default,
          creationOnly: option.creationOnly,
          type:
            overlay?.optionTypes?.[option.name] ??
            GENERIC_OPTION_TYPES[option.name] ??
            inferOptionType(option),
        },
      ]),
    );
    classes.set(name, {
      name,
      library: name.startsWith('ttk.') ? 'ttk' : 'tk',
      tclCommand: rawClass.tclCommand,
      category: overlay?.category ?? 'other',
      children: overlay?.children,
      curated: overlay !== undefined,
      options,
      aliases: new Map(Object.entries(rawClass.aliases)),
      commonOptions: (overlay?.commonOptions ?? []).filter((o) => options.has(o)),
      events: [...(overlay?.events ?? []), ...COMMON_EVENTS],
    });
  }
  return { tkVersion: source.tkVersion, classes };
}

let catalog: WidgetCatalog | undefined;

/** Tk から抽出したカタログ（初回呼び出し時に構築する） */
export function getWidgetCatalog(): WidgetCatalog {
  catalog ??= buildCatalog(rawCatalog, CLASS_OVERLAYS);
  return catalog;
}

/** 別名を正式名に解決してオプション情報を返す */
export function findOption(
  widgetClass: WidgetClassInfo,
  name: string,
): { readonly option: OptionInfo; readonly isAlias: boolean } | undefined {
  const canonical = widgetClass.aliases.get(name);
  const option = widgetClass.options.get(canonical ?? name);
  return option && { option, isAlias: canonical !== undefined };
}
