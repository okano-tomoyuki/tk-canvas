import {
  computeLayout,
  findDropTarget,
  findNode,
  pathTo,
  walkNodes,
  type AnyNode,
  type DropTarget,
  type LayoutResult,
  type Rect,
  type TkuiDocument,
} from '@tk-designer/core';
import { useMemo, useRef, useState, type DragEvent } from 'react';
import { addWidgetAt, moveWidgetTo } from '../editing.ts';
import { postMessage } from '../vscode.ts';
import { useDocumentStore, useUiStore } from '../store/stores.ts';
import { createCanvasMeasure, createMetrics } from './metrics.ts';
import { WidgetView } from './WidgetView.tsx';

/** 文字幅の計測結果をキャッシュするため、メトリクスはアプリ全体で1つだけ作る */
const metrics = createMetrics(createCanvasMeasure());

/**
 * デザイナーのキャンバス。レイアウトエンジン（docs/layout.md）で計算した位置にウィジェットを描く。
 * - クリックで選択、ドラッグで移動、パレットからのドロップで追加
 * - 選択中（またはサイドバーでマウスを乗せた）変数を参照しているウィジェットに印をつける
 */
export function DesignCanvas() {
  const doc = useDocumentStore((s) => s.document);
  const selectedId = useUiStore((s) => s.selectedId);
  const select = useUiStore((s) => s.select);
  const hoveredVariable = useUiStore((s) => s.hoveredVariable);
  const dragging = useUiStore((s) => s.dragging);
  const clientRef = useRef<HTMLDivElement>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>();

  const selectedTabs = useMemo(() => tabsToShow(doc, selectedId), [doc, selectedId]);
  const layout = useMemo(
    () => (doc ? computeLayout(doc, metrics, { selectedTabs }) : undefined),
    [doc, selectedTabs],
  );
  const variableMarks = useMemo(
    () => (doc ? variableReferences(doc, selectedId, hoveredVariable) : []),
    [doc, selectedId, hoveredVariable],
  );

  if (!doc || !layout) return null;
  const root = layout.get(doc.root.id);
  if (!root) return null;

  /** ポインタ位置（ルートウィンドウの内側の左上が原点）でのドロップ先 */
  const targetAt = (e: DragEvent): DropTarget | undefined => {
    const client = clientRef.current?.getBoundingClientRect();
    if (!client || !dragging) return undefined;
    const point = { x: e.clientX - client.left, y: e.clientY - client.top };
    return findDropTarget(doc, layout, point, dragging.kind === 'move' ? dragging.id : undefined);
  };

  return (
    <section className="panel canvas-panel" aria-label="キャンバス">
      <div className="canvas-toolbar">
        <button
          type="button"
          title="DSL の codegen の設定に従ってコードを生成する（既存のファイルはマーカー区間だけを更新）"
          onClick={() => {
            postMessage({ type: 'generateCode' });
          }}
        >
          コード生成
        </button>
      </div>
      <div className="design-window" style={{ width: root.rect.width }}>
        <div className="design-window-title">{doc.root.window?.title ?? doc.root.id}</div>
        {/* 背景のクリックはウィンドウ（ルート）の選択 */}
        <div
          ref={clientRef}
          className={doc.root.id === selectedId ? 'design-client selected' : 'design-client'}
          style={{ width: root.rect.width, height: root.rect.height }}
          onClick={() => {
            select(doc.root.id);
          }}
          onDragOver={(e) => {
            const target = targetAt(e);
            if (!target) return;
            // preventDefault でドロップを受け付ける
            e.preventDefault();
            e.dataTransfer.dropEffect = dragging?.kind === 'move' ? 'move' : 'copy';
            if (!sameTarget(target, dropTarget)) setDropTarget(target);
          }}
          onDragLeave={(e) => {
            // キャンバスの外へ出たときだけ消す（子要素間の移動でも dragleave が起きるため）
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropTarget(undefined);
          }}
          onDrop={(e) => {
            e.preventDefault();
            const target = targetAt(e);
            setDropTarget(undefined);
            if (!target || !dragging) return;
            if (dragging.kind === 'new') addWidgetAt(dragging.className, target);
            else moveWidgetTo(dragging.id, target);
          }}
        >
          {renderWidgets(doc, layout, selectedTabs, select)}
          {variableMarks.map(({ id, variable }) => {
            const box = layout.get(id);
            return box?.mapped ? (
              <div key={`${id}:${variable}`} className="variable-overlay" style={toStyle(box.rect)}>
                <span className="variable-tag">{variable}</span>
              </div>
            ) : null;
          })}
          <SelectionOverlay layout={layout} selectedId={selectedId} rootId={doc.root.id} />
          {dropTarget && <DropOverlay layout={layout} target={dropTarget} />}
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
  return <div className="selection-overlay" style={toStyle(box.rect)} />;
}

/** ドロップ先のコンテナと、挿入位置（grid のセル・pack の挿入線・place の座標）を示す */
function DropOverlay({
  layout,
  target,
}: {
  readonly layout: LayoutResult;
  readonly target: DropTarget;
}) {
  const container = layout.get(target.parentId);
  return (
    <>
      {container && <div className="drop-container" style={toStyle(container.rect)} />}
      <div
        className={`drop-indicator drop-indicator-${target.kind}`}
        style={toStyle(target.indicator)}
      />
    </>
  );
}

function toStyle(rect: Rect) {
  return { left: rect.x, top: rect.y, width: rect.width, height: rect.height };
}

function sameTarget(a: DropTarget, b: DropTarget | undefined): boolean {
  return (
    b !== undefined &&
    a.parentId === b.parentId &&
    a.index === b.index &&
    JSON.stringify(a.placement) === JSON.stringify(b.placement) &&
    JSON.stringify(a.indicator) === JSON.stringify(b.indicator)
  );
}

/**
 * 印をつける（ウィジェット, 変数）の組。
 * サイドバーでマウスを乗せた変数があればそれを、なければ選択中のウィジェットが参照している変数を対象にし、
 * その変数を参照している（選択中のもの以外の）ウィジェットを返す。
 */
function variableReferences(
  doc: TkuiDocument,
  selectedId: string | undefined,
  hoveredVariable: string | undefined,
): { id: string; variable: string }[] {
  const selected = selectedId ? findNode(doc, selectedId)?.node : undefined;
  const variables = hoveredVariable ? [hoveredVariable] : referencedVariables(selected);
  if (variables.length === 0) return [];
  const marks: { id: string; variable: string }[] = [];
  for (const node of walkNodes(doc)) {
    if (!hoveredVariable && node === selected) continue;
    for (const variable of referencedVariables(node)) {
      if (variables.includes(variable)) marks.push({ id: node.id, variable });
    }
  }
  return marks;
}

function referencedVariables(node: AnyNode | undefined): string[] {
  return Object.values(node?.options ?? {}).flatMap((v) =>
    typeof v === 'object' && 'var' in v ? [v.var] : [],
  );
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
