import {
  computeLayout,
  pathTo,
  walkNodes,
  type AnyNode,
  type LayoutResult,
  type TkuiDocument,
} from '@tk-designer/core';
import { useMemo } from 'react';
import { useDocumentStore, useUiStore } from '../store/stores.ts';
import { createCanvasMeasure, createMetrics } from './metrics.ts';
import { WidgetView } from './WidgetView.tsx';

/** 文字幅の計測結果をキャッシュするため、メトリクスはアプリ全体で1つだけ作る */
const metrics = createMetrics(createCanvasMeasure());

/**
 * デザイナーのキャンバス。レイアウトエンジン（docs/layout.md）で計算した位置にウィジェットを描き、クリックで選択する。
 */
export function DesignCanvas() {
  const doc = useDocumentStore((s) => s.document);
  const selectedId = useUiStore((s) => s.selectedId);
  const select = useUiStore((s) => s.select);

  const selectedTabs = useMemo(() => tabsToShow(doc, selectedId), [doc, selectedId]);
  const layout = useMemo(
    () => (doc ? computeLayout(doc, metrics, { selectedTabs }) : undefined),
    [doc, selectedTabs],
  );

  if (!doc || !layout) return null;
  const root = layout.get(doc.root.id);
  if (!root) return null;

  return (
    <section className="panel canvas-panel" aria-label="キャンバス">
      <div className="design-window" style={{ width: root.rect.width }}>
        <div className="design-window-title">{doc.root.window?.title ?? doc.root.id}</div>
        {/* 背景のクリックはウィンドウ（ルート）の選択 */}
        <div
          className={doc.root.id === selectedId ? 'design-client selected' : 'design-client'}
          style={{ width: root.rect.width, height: root.rect.height }}
          onClick={() => {
            select(doc.root.id);
          }}
        >
          {renderWidgets(doc, layout, selectedTabs, select)}
          <SelectionOverlay layout={layout} selectedId={selectedId} rootId={doc.root.id} />
        </div>
      </div>
    </section>
  );
}

/** 親から順に描くことで、子が手前に重なり、クリックも子が受け取る */
function renderWidgets(
  doc: TkuiDocument,
  layout: LayoutResult,
  selectedTabs: ReadonlyMap<string, string>,
  select: (id: string) => void,
) {
  return [...walkNodes(doc)]
    .filter((node) => node !== doc.root)
    .map((node) => {
      const box = layout.get(node.id);
      if (!box?.mapped) return null;
      return (
        <WidgetView
          key={node.id}
          node={node}
          rect={box.rect}
          activeTab={selectedTabs.get(node.id) ?? node.children?.[0]?.id}
          onSelect={select}
        />
      );
    });
}

/**
 * 選択枠。ウィジェットとは別に最前面へ描き、クリックは下のウィジェットへ通す
 * （選択したコンテナを前面に出すと、子をクリックできなくなるため）。
 */
function SelectionOverlay({
  layout,
  selectedId,
  rootId,
}: {
  readonly layout: LayoutResult;
  readonly selectedId: string | undefined;
  readonly rootId: string;
}) {
  const box = selectedId && selectedId !== rootId ? layout.get(selectedId) : undefined;
  if (!box?.mapped) return null;
  const { x, y, width, height } = box.rect;
  return <div className="selection-overlay" style={{ left: x, top: y, width, height }} />;
}

/** 選択中のウィジェットを含むタブを、経路上の各 Notebook で表示する */
function tabsToShow(
  doc: TkuiDocument | undefined,
  selectedId: string | undefined,
): ReadonlyMap<string, string> {
  const tabs = new Map<string, string>();
  if (!doc || !selectedId) return tabs;
  const path: readonly AnyNode[] = pathTo(doc, selectedId) ?? [];
  path.forEach((node, i) => {
    const next = path[i + 1];
    if (node.class === 'ttk.Notebook' && next) tabs.set(node.id, next.id);
  });
  return tabs;
}
