/**
 * キャンバス表示用の寸法（LayoutMetrics）の暫定実装。
 *
 * Windows の Tk 8.6（vista テーマ、TkDefaultFont = Segoe UI 9pt）で記録した値（core/src/layout/fixtures/*.tk.json）を
 * 目安にした概算で、要求サイズの推定（docs/layout.md「制約・今後の課題」）で置き換える前提のもの。
 */
import type {
  AnyNode,
  Insets,
  LayoutMetrics,
  LiteralValue,
  OptionValue,
  Size,
} from '@tk-designer/core';

/** Tk の既定フォント（Windows では Segoe UI 9pt = 96dpi で 12px） */
export const TK_DEFAULT_FONT = '12px "Segoe UI", sans-serif';

/** 平均的な文字幅（Entry などの width は文字数で指定する） */
const AVERAGE_CHAR_WIDTH = 6;
const LINE_HEIGHT = 15;

export type MeasureText = (text: string) => number;

export function createMetrics(measureText: MeasureText): LayoutMetrics {
  return {
    naturalSize: (node) => roundSize(naturalSize(node, measureText)),
    insets: (node) => insets(node),
  };
}

/** DOM の canvas で文字幅を計測する（結果はキャッシュする） */
export function createCanvasMeasure(): MeasureText {
  const context = document.createElement('canvas').getContext('2d');
  const cache = new Map<string, number>();
  return (text) => {
    const cached = cache.get(text);
    if (cached !== undefined) return cached;
    if (!context) return text.length * AVERAGE_CHAR_WIDTH;
    context.font = TK_DEFAULT_FONT;
    const width = Math.ceil(context.measureText(text).width);
    cache.set(text, width);
    return width;
  };
}

/** 表示する文字列。変数参照は変数名を表示する */
export function displayText(node: AnyNode): string {
  const text = node.options?.text;
  if (text !== undefined) return literalToString(text);
  const variable = node.options?.textvariable;
  if (typeof variable === 'object' && 'var' in variable) return `{${variable.var}}`;
  return '';
}

function naturalSize(node: AnyNode, measure: MeasureText): Size {
  const width = num(node.options?.width);
  const height = num(node.options?.height);
  const textWidth = measure(displayText(node));

  switch (node.class) {
    case 'ttk.Label':
    case 'tk.Label':
    case 'tk.Message':
      return { width: textWidth + 2, height: 19 };
    case 'ttk.Button':
    case 'tk.Button':
    case 'ttk.Menubutton':
    case 'tk.Menubutton':
      return { width: Math.max(76, textWidth + 16), height: 25 };
    case 'ttk.Checkbutton':
    case 'ttk.Radiobutton':
    case 'tk.Checkbutton':
    case 'tk.Radiobutton':
      return { width: textWidth + 20, height: 19 };
    case 'ttk.Entry':
    case 'tk.Entry':
      return { width: (width ?? 20) * AVERAGE_CHAR_WIDTH + 6, height: 21 };
    case 'ttk.Combobox':
    case 'ttk.Spinbox':
    case 'tk.Spinbox':
      return { width: (width ?? 20) * AVERAGE_CHAR_WIDTH + 23, height: 21 };
    case 'tk.Text':
      return { width: (width ?? 80) * 7 + 4, height: (height ?? 24) * LINE_HEIGHT + 4 };
    case 'tk.Listbox':
      return { width: (width ?? 20) * 7 + 4, height: (height ?? 10) * LINE_HEIGHT + 4 };
    case 'ttk.Treeview':
      return { width: 200, height: (height ?? 10) * 20 + 24 };
    case 'tk.Canvas':
      return { width: width ?? 200, height: height ?? 150 };
    case 'ttk.Progressbar':
    case 'ttk.Scale':
    case 'tk.Scale': {
      const length = num(node.options?.length) ?? 100;
      return isVertical(node) ? { width: 20, height: length } : { width: length, height: 20 };
    }
    case 'ttk.Scrollbar':
    case 'tk.Scrollbar':
      return { width: 17, height: 17 };
    case 'ttk.Separator':
      return { width: 2, height: 2 };
    default:
      // Frame・Notebook など: width / height オプション（既定 0）
      return { width: width ?? 0, height: height ?? 0 };
  }
}

function insets(node: AnyNode): Insets {
  const border = num(node.options?.borderwidth) ?? 0;
  switch (node.class) {
    case 'tk.Tk':
    case 'tk.Toplevel':
    case 'tk.Frame': {
      const b = border + (num(node.options?.highlightthickness) ?? 0);
      const x = b + (num(node.options?.padx) ?? 0);
      const y = b + (num(node.options?.pady) ?? 0);
      return { left: x, top: y, right: x, bottom: y };
    }
    case 'tk.LabelFrame': {
      const b =
        (num(node.options?.borderwidth) ?? 2) + (num(node.options?.highlightthickness) ?? 0);
      const x = b + (num(node.options?.padx) ?? 0);
      const y = b + (num(node.options?.pady) ?? 0);
      return { left: x, top: Math.max(y, 17), right: x, bottom: y };
    }
    case 'ttk.Frame':
      return padding(node, border);
    case 'ttk.Labelframe': {
      const p = padding(node, 2);
      return { ...p, top: p.top + 17 };
    }
    case 'ttk.Notebook': {
      // タブの行（高さ約 22）と、ページの枠線
      const p = padding(node, 0);
      return { left: p.left + 2, top: p.top + 24, right: p.right + 2, bottom: p.bottom + 2 };
    }
    default:
      return { left: 0, top: 0, right: 0, bottom: 0 };
  }
}

/** ttk の -padding（1〜4値）と枠線 */
function padding(node: AnyNode, border: number): Insets {
  const value = node.options?.padding;
  const values = (
    Array.isArray(value) ? value : typeof value === 'string' ? value.split(/\s+/) : [value]
  ).map((v) => num(v as OptionValue) ?? 0);
  const [left = 0, top = left, right = left, bottom = top] = values;
  return { left: left + border, top: top + border, right: right + border, bottom: bottom + border };
}

function isVertical(node: AnyNode): boolean {
  return node.options?.orient === 'vertical';
}

/** 数値、または "10" のような数値文字列（単位つきの距離は概算で扱わない） */
function num(value: OptionValue | undefined): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return undefined;
}

function literalToString(value: OptionValue): string {
  if (typeof value === 'object' && !Array.isArray(value)) return '';
  if (Array.isArray(value))
    return (value as readonly LiteralValue[]).map((v) => literalToString(v)).join(' ');
  return String(value);
}

function roundSize(size: Size): Size {
  return {
    width: Math.max(0, Math.round(size.width)),
    height: Math.max(0, Math.round(size.height)),
  };
}
