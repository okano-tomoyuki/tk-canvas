/**
 * ウィジェットを追加・移動したときに与える初期値。
 */
import { getWidgetCatalog } from '../catalog/catalog.ts';
import type { ContainerKind } from '../dsl/placement.ts';
import type { Layout, OptionValue, Placement, WidgetNode } from '../dsl/schema.ts';
import { isBaseMemberName } from '../identifier.ts';
import { collectMemberNames } from './tree.ts';
import type { TkuiDocument } from '../dsl/schema.ts';

/** 新しいウィジェットの id を作る（例: ttk.Button → button1, button2, ...） */
export function nextWidgetId(doc: TkuiDocument, className: string): string {
  const base = (className.split('.').pop() ?? 'widget').toLowerCase();
  const used = collectMemberNames(doc);
  for (let n = 1; ; n++) {
    const candidate = `${base}${String(n)}`;
    if (!used.has(candidate) && !isBaseMemberName(candidate)) return candidate;
  }
}

/** 他と重ならないメンバ名を作る（base が空いていればそのまま、使われていれば base2, base3, ...） */
export function nextMemberName(doc: TkuiDocument, base: string): string {
  const used = collectMemberNames(doc);
  if (!used.has(base) && !isBaseMemberName(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}${String(n)}`;
    if (!used.has(candidate)) return candidate;
  }
}

/** 追加時のオプション。表示文字列を持つウィジェットには id を仮の文字列として入れる */
export function defaultOptions(
  className: string,
  id: string,
): Record<string, OptionValue> | undefined {
  const info = getWidgetCatalog().classes.get(className);
  if (info?.commonOptions.includes('text')) return { text: id };
  return undefined;
}

/** 追加時の layout。子を layout で並べるクラスには grid を与える */
export function defaultLayout(className: string): Layout | undefined {
  const info = getWidgetCatalog().classes.get(className);
  return info?.children === 'layout' ? { manager: 'grid' } : undefined;
}

/**
 * 親の置き方に応じた初期 placement。
 * grid では既存の兄弟の下の行に置く。何も指定しなくてよい場合は undefined。
 */
export function defaultPlacement(
  kind: ContainerKind | undefined,
  siblings: readonly WidgetNode[],
  id: string,
): Placement | undefined {
  switch (kind) {
    case 'grid': {
      const rows = siblings.map((s) => {
        const p = s.placement;
        return p && 'row' in p && typeof p.row === 'number' ? p.row + (p.rowspan ?? 1) : 0;
      });
      return { row: Math.max(0, ...rows), column: 0 };
    }
    case 'place':
      return { x: 0, y: 0 };
    case 'notebook':
      return { text: id };
    case 'pack':
    case 'paned':
    case undefined:
      return undefined;
  }
}
