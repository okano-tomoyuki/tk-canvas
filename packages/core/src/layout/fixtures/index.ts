/**
 * Tk で記録したレイアウトの検証データ（tools/layout/record.mts で生成）。
 * フィクスチャを追加したら、ここにも追加する。
 */
import gridShrinkTk from './grid-shrink.tk.json' with { type: 'json' };
import gridShrink from './grid-shrink.tkui.json' with { type: 'json' };
import gridWeightsTk from './grid-weights.tk.json' with { type: 'json' };
import gridWeights from './grid-weights.tkui.json' with { type: 'json' };
import nestedTk from './nested.tk.json' with { type: 'json' };
import nested from './nested.tkui.json' with { type: 'json' };
import packBasicTk from './pack-basic.tk.json' with { type: 'json' };
import packBasic from './pack-basic.tkui.json' with { type: 'json' };
import packExpandTk from './pack-expand.tk.json' with { type: 'json' };
import packExpand from './pack-expand.tkui.json' with { type: 'json' };

export interface TkRecord {
  readonly tkVersion: string;
  readonly windowingSystem: string;
  readonly widgets: Readonly<
    Record<
      string,
      {
        readonly requested: readonly number[];
        readonly rect: readonly number[];
        readonly mapped: boolean;
      }
    >
  >;
}

export const LAYOUT_FIXTURES: readonly { name: string; document: unknown; tk: TkRecord }[] = [
  { name: 'pack-basic', document: packBasic, tk: packBasicTk },
  { name: 'pack-expand', document: packExpand, tk: packExpandTk },
  { name: 'grid-weights', document: gridWeights, tk: gridWeightsTk },
  { name: 'grid-shrink', document: gridShrink, tk: gridShrinkTk },
  { name: 'nested', document: nested, tk: nestedTk },
];
