import type { HandlerSignature } from '../dsl/signature.ts';
import type { VariableType } from '../dsl/schema.ts';

/** オプション値の型。プロパティエディタの入力部品の選択と、値の検証に使う */
export type OptionType =
  | { readonly kind: 'string' }
  | { readonly kind: 'integer' }
  | { readonly kind: 'number' }
  | { readonly kind: 'boolean' }
  /** 画面上の距離。数値（ピクセル）または "2c" "10p" のような単位つき文字列 */
  | { readonly kind: 'distance' }
  | { readonly kind: 'color' }
  | { readonly kind: 'font' }
  | { readonly kind: 'image' }
  | { readonly kind: 'bitmap' }
  | { readonly kind: 'cursor' }
  /** ttk のスタイル名 */
  | { readonly kind: 'style' }
  /** 他のウィジェット（パス名）への参照 */
  | { readonly kind: 'window' }
  /** Tcl のリスト（DSL では配列、または空白区切りの文字列で書く） */
  | { readonly kind: 'list' }
  | { readonly kind: 'enum'; readonly values: readonly string[] }
  | { readonly kind: 'variable'; readonly variableTypes: readonly VariableType[] }
  /** signature が無いものは、DSL からのハンドラ参照にまだ対応していない */
  | { readonly kind: 'callback'; readonly signature?: HandlerSignature };

export interface OptionInfo {
  readonly name: string;
  readonly dbName: string;
  readonly dbClass: string;
  /** Tk の既定値（文字列表現） */
  readonly default: string;
  /** 生成時にしか指定できない */
  readonly creationOnly: boolean;
  readonly type: OptionType;
}

/** パレットでの分類 */
export type WidgetCategory =
  'window' | 'container' | 'basic' | 'input' | 'selection' | 'display' | 'other';

/**
 * 子の置き方。
 * - layout: layout（pack / grid / place）で並べる
 * - notebook / paned: クラスで決まる（layout は書けない）
 */
export type ChildrenKind = 'layout' | 'notebook' | 'paned';

export interface WidgetClassInfo {
  /** DSL のクラス名（例: "ttk.Button"） */
  readonly name: string;
  readonly library: 'tk' | 'ttk';
  /** Tcl のコマンド名（例: "ttk::button"）。ルートは "." */
  readonly tclCommand: string;
  readonly category: WidgetCategory;
  /** 子を持てない場合は undefined */
  readonly children: ChildrenKind | undefined;
  /** 手書きの補足情報があるか（頻出ウィジェットから順に整備している） */
  readonly curated: boolean;
  /** オプション名 → 情報（別名は含まない） */
  readonly options: ReadonlyMap<string, OptionInfo>;
  /** 別名 → 正式名（例: "bd" → "borderwidth"） */
  readonly aliases: ReadonlyMap<string, string>;
  /** プロパティエディタで優先して表示するオプション */
  readonly commonOptions: readonly string[];
  /** bind シーケンスの候補（仮想イベントを含む） */
  readonly events: readonly string[];
}

export interface WidgetCatalog {
  readonly tkVersion: string;
  readonly classes: ReadonlyMap<string, WidgetClassInfo>;
}
