import type * as z from 'zod';
import { getWidgetCatalog } from '../catalog/catalog.ts';
import {
  GridPlacement,
  NotebookTabPlacement,
  PackPlacement,
  PanePlacement,
  PlacePlacement,
  type GeometryManager,
  type RootNode,
  type WidgetNode,
} from './schema.ts';

/** 子の置き方の種類。ジオメトリマネージャ、またはウィジェット固有の追加方法 */
export type ContainerKind = GeometryManager | 'notebook' | 'paned';

export const PLACEMENT_SCHEMAS: Readonly<Record<ContainerKind, z.ZodType>> = {
  pack: PackPlacement,
  grid: GridPlacement,
  place: PlacePlacement,
  notebook: NotebookTabPlacement,
  paned: PanePlacement,
};

/** このノードが子をどう置くか。子を持てない、または layout が未指定なら undefined */
export function containerKindOf(node: RootNode | WidgetNode): ContainerKind | undefined {
  const children = getWidgetCatalog().classes.get(node.class)?.children;
  switch (children) {
    case 'layout':
      return node.layout?.manager;
    case 'notebook':
    case 'paned':
      return children;
    case undefined:
      return undefined;
  }
}
