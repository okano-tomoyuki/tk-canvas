import type { AnyNode, Rect } from '@tk-designer/core';
import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { displayText } from './metrics.ts';

interface WidgetViewProps {
  readonly node: AnyNode;
  /** ルートウィンドウの内側を原点とする位置 */
  readonly rect: Rect;
  /** Notebook で表示中のタブ（子の id） */
  readonly activeTab: string | undefined;
  readonly onSelect: (id: string) => void;
}

/** 見た目の種類。Tk のクラスを、描き方の近いものごとにまとめる */
type Visual =
  | 'label'
  | 'button'
  | 'check'
  | 'radio'
  | 'entry'
  | 'field'
  | 'frame'
  | 'labelframe'
  | 'notebook'
  | 'bar'
  | 'separator'
  | 'generic';

const VISUALS: Readonly<Record<string, Visual>> = {
  'ttk.Label': 'label',
  'tk.Label': 'label',
  'tk.Message': 'label',
  'ttk.Button': 'button',
  'tk.Button': 'button',
  'ttk.Menubutton': 'button',
  'tk.Menubutton': 'button',
  'ttk.Checkbutton': 'check',
  'tk.Checkbutton': 'check',
  'ttk.Radiobutton': 'radio',
  'tk.Radiobutton': 'radio',
  'ttk.Entry': 'entry',
  'tk.Entry': 'entry',
  'ttk.Combobox': 'entry',
  'ttk.Spinbox': 'entry',
  'tk.Spinbox': 'entry',
  'tk.Text': 'field',
  'tk.Listbox': 'field',
  'ttk.Treeview': 'field',
  'tk.Canvas': 'field',
  'ttk.Frame': 'frame',
  'tk.Frame': 'frame',
  'ttk.PanedWindow': 'frame',
  'tk.PanedWindow': 'frame',
  'ttk.Labelframe': 'labelframe',
  'tk.LabelFrame': 'labelframe',
  'ttk.Notebook': 'notebook',
  'ttk.Progressbar': 'bar',
  'ttk.Scale': 'bar',
  'tk.Scale': 'bar',
  'ttk.Scrollbar': 'bar',
  'tk.Scrollbar': 'bar',
  'ttk.Separator': 'separator',
};

/**
 * 1つのウィジェットの簡易的な見た目。実際の Tk の描画は再現せず、種類と位置・大きさが分かることを目的とする。
 */
export function WidgetView({ node, rect, activeTab, onSelect }: WidgetViewProps) {
  const visual = VISUALS[node.class] ?? 'generic';
  const style: CSSProperties = {
    left: rect.x,
    top: rect.y,
    width: rect.width,
    height: rect.height,
  };
  const background = node.options?.background;
  if (typeof background === 'string') style.background = background;
  Object.assign(style, reliefStyle(node));

  const handleClick = (e: MouseEvent) => {
    // 背後のウィジェット（親）が選択されないようにする
    e.stopPropagation();
    onSelect(node.id);
  };

  return (
    <div
      className={`widget widget-${visual}`}
      style={style}
      title={`${node.id} (${node.class})`}
      onClick={handleClick}
    >
      {renderContent(node, visual, activeTab, onSelect)}
    </div>
  );
}

const RELIEF_BORDER_STYLES: Readonly<Record<string, CSSProperties['borderStyle']>> = {
  raised: 'outset',
  sunken: 'inset',
  groove: 'groove',
  ridge: 'ridge',
  solid: 'solid',
};

/** classic ウィジェットの -relief / -borderwidth を枠線で表す（flat や幅 0 の場合は何もしない） */
function reliefStyle(node: AnyNode): CSSProperties {
  const relief = node.options?.relief;
  const width = node.options?.borderwidth;
  if (typeof relief !== 'string' || typeof width !== 'number' || width <= 0) return {};
  const borderStyle = RELIEF_BORDER_STYLES[relief];
  if (!borderStyle) return {};
  return { borderStyle, borderWidth: width, borderColor: '#d4d0c8', boxShadow: 'none' };
}

function renderContent(
  node: AnyNode,
  visual: Visual,
  activeTab: string | undefined,
  onSelect: (id: string) => void,
): ReactNode {
  const text = displayText(node);
  switch (visual) {
    case 'label':
    case 'button':
    case 'entry':
      return <span className="widget-text">{text}</span>;
    case 'check':
    case 'radio':
      return (
        <>
          <span className={`widget-indicator widget-indicator-${visual}`} />
          <span className="widget-text">{text}</span>
        </>
      );
    case 'labelframe':
      return <span className="widget-caption">{text}</span>;
    case 'notebook':
      return (
        <div className="widget-tabs">
          {(node.children ?? []).map((child) => {
            const placement = child.placement as { text?: string } | undefined;
            return (
              <span
                key={child.id}
                className={child.id === activeTab ? 'widget-tab active' : 'widget-tab'}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(child.id);
                }}
              >
                {placement?.text || child.id}
              </span>
            );
          })}
        </div>
      );
    case 'field':
    case 'generic':
      return <span className="widget-class">{node.class}</span>;
    case 'frame':
    case 'bar':
    case 'separator':
      return null;
  }
}
