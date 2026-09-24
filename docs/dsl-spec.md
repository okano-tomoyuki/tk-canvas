# DSL 仕様（formatVersion 1）

画面定義ファイル `*.tkui.json` の仕様。検討の経緯は [dsl-design-notes.md](dsl-design-notes.md) を参照。

- スキーマの実装: [packages/core/src/dsl/schema.ts](../packages/core/src/dsl/schema.ts)（正。本書と食い違う場合は実装を正として本書を直す）
- 意味の検証: [packages/core/src/dsl/validate.ts](../packages/core/src/dsl/validate.ts)
- JSON Schema（生成物）: [packages/extension/schema/tkui.schema.json](../packages/extension/schema/tkui.schema.json)

## 1. 基本方針

- **Tk の概念とオプション名をそのまま使う**。言語（C++ / Python）固有の表現は含めない（ADR 0002）。
- **1ファイル = 1ウィンドウ = 生成される1クラス**（codegen-design.md M9）。
- JSON で記述する（D1）。拡張が保存するときは §10 の正規形で書き出す。

## 2. 例

```json
{
  "formatVersion": 1,
  "variables": {
    "user_name": { "type": "StringVar", "value": "" }
  },
  "root": {
    "id": "main_window",
    "class": "tk.Tk",
    "window": { "title": "Sample", "geometry": "400x300" },
    "layout": {
      "manager": "grid",
      "columns": { "1": { "weight": 1 } },
      "rows": { "2": { "weight": 1 } }
    },
    "children": [
      {
        "id": "name_label",
        "class": "ttk.Label",
        "options": { "text": "Name:" },
        "placement": { "row": 0, "column": 0, "sticky": "w", "padx": [8, 4] }
      },
      {
        "id": "name_entry",
        "class": "ttk.Entry",
        "options": { "textvariable": { "var": "user_name" } },
        "placement": { "row": 0, "column": 1, "sticky": "ew" },
        "bindings": [{ "sequence": "<Return>", "handler": "on_name_return" }]
      },
      {
        "id": "submit_button",
        "class": "ttk.Button",
        "options": { "text": "OK", "command": { "handler": "on_submit" } },
        "placement": { "row": 1, "column": 1, "sticky": "e" }
      },
      {
        "id": "tabs",
        "class": "ttk.Notebook",
        "placement": { "row": 2, "column": 0, "columnspan": 2, "sticky": "nsew" },
        "children": [
          {
            "id": "general_page",
            "class": "ttk.Frame",
            "placement": { "text": "General" },
            "layout": { "manager": "pack" }
          }
        ]
      }
    ]
  }
}
```

## 3. ドキュメント

| キー | 必須 | 型 | 説明 |
|---|---|---|---|
| `formatVersion` | ○ | `1` | フォーマットのバージョン。形式を変えたときに上げ、旧形式からの移行に使う |
| `variables` | | 名前 → 変数 | §5 |
| `root` | ○ | ルートノード | §4 |
| `$schema` | | 文字列 | エディタ向け。内容には影響しない |

## 4. ノード

### 4.1 ルートノード（ウィンドウ）

| キー | 必須 | 型 | 説明 |
|---|---|---|---|
| `id` | ○ | 識別子 | ウィンドウのメンバ名 |
| `class` | ○ | `"tk.Tk"` \| `"tk.Toplevel"` | |
| `window` | | オブジェクト | wm 系の設定（下表） |
| `options` | | 名前 → 値 | §6 |
| `layout` | | オブジェクト | §7.1 |
| `bindings` | | 配列 | §8 |
| `children` | | ウィジェットの配列 | |

`window`:

| キー | 型 | 対応する Tk |
|---|---|---|
| `title` | 文字列 | `wm title` |
| `geometry` | `"幅x高さ"`、`"幅x高さ+x+y"`、`"+x+y"` | `wm geometry` |
| `resizable` | `[横, 縦]`（真偽） | `wm resizable` |
| `minsize` / `maxsize` | `[幅, 高さ]`（0以上の整数） | `wm minsize` / `wm maxsize` |

### 4.2 ウィジェットノード

| キー | 必須 | 型 | 説明 |
|---|---|---|---|
| `id` | ○ | 識別子 | 生成コードのメンバ名 |
| `class` | ○ | `"tk.<Class>"` \| `"ttk.<Class>"` | 例: `"ttk.Button"`、`"tk.Text"`。クラス名は tkinter / cpp_tk と同じ |
| `options` | | 名前 → 値 | §6 |
| `layout` | | オブジェクト | 子を持つ場合に指定する（§7.1） |
| `placement` | | オブジェクト | 親の中での置き方（§7.2） |
| `bindings` | | 配列 | §8 |
| `children` | | ウィジェットの配列 | 配列の順序が生成順。pack では配置結果にも影響する |

- `tk.Tk` / `tk.Toplevel` はルート以外に使えない。
- `window` はルートにのみ書ける。

## 5. 変数

`variables` のキーが変数名（生成コードのメンバ名）になる。

| `type` | `value`（初期値、省略可） |
|---|---|
| `StringVar` | 文字列 |
| `IntVar` | 整数 |
| `DoubleVar` | 数値 |
| `BooleanVar` | 真偽 |

どこからも参照されていない変数は警告になる。

## 6. オプション

`options` のキーは Tk のオプション名（先頭の `-` は付けない、小文字）。値は次のいずれか。

| 種類 | 書き方 | 例 |
|---|---|---|
| リテラル | 文字列・数値・真偽、またはそれらの配列（入れ子可。Tcl のリストに対応） | `"OK"`、`30`、`["Arial", 12, "bold"]` |
| 変数参照 | `{ "var": "変数名" }` | `{ "var": "user_name" }` |
| ハンドラ参照 | `{ "handler": "メソッド名" }` | `{ "handler": "on_submit" }` |

どのクラスにどのオプションがあり、どの値を書けるかは**ウィジェットカタログ**（[catalog.md](catalog.md)）で決まる。

- カタログにないオプションはエラー。別名（`bd`、`bg` 等）もエラーとし、正式名（`borderwidth`、`background`）で書く。
- 値はオプションの型に合っていなければならない。

| 型 | 書ける値 |
|---|---|
| variable（`textvariable`、`variable` 等） | 変数参照のみ。受け付ける変数型はクラスごとに決まる（例: `textvariable` は StringVar、ttk.Checkbutton の `variable` は BooleanVar / IntVar / StringVar） |
| callback（`command` 等） | ハンドラ参照のみ。シグネチャが定義されていないもの（`xscrollcommand`、`validatecommand` 等）には、まだ参照を書けない |
| integer / number / boolean | 整数 / 数値 / 真偽 |
| distance | 数値（ピクセル）、または `"2c"` `"10p"` のような単位つき文字列 |
| enum（`relief`、`anchor`、`orient` 等） | 候補のいずれかの文字列 |
| list（Combobox の `values` 等） | 配列、または空白区切りの文字列 |
| font | `"Arial 12 bold"` のような文字列、または `["Arial", 12, "bold"]` のような配列 |
| color / image / bitmap / cursor / style / window | 文字列 |
| string | 任意のリテラル |

## 7. 配置

### 7.1 layout（コンテナが子をどう並べるか）

| `manager` | 追加のキー |
|---|---|
| `"pack"` | `propagate`（真偽） |
| `"grid"` | `propagate`（真偽）、`columns`・`rows`（番号 → 設定） |
| `"place"` | なし |

`columns` / `rows` のキーは行・列の番号（JSON のキーは文字列のため `"0"`, `"1"` と書く）。設定は `weight`・`minsize`・`pad`（0以上の整数）と `uniform`（文字列）で、`grid_columnconfigure` / `grid_rowconfigure` に対応する。

Tk の制約（同じ親の中で pack と grid を混在できない）を、manager を親に1つだけ持たせることで表している。

子を持てるかどうか、子をどう置くかはクラスで決まる（カタログの `children`）。
子を持てるクラスは、ウィンドウ（Tk, Toplevel）と Frame / Labelframe（classic・ttk）、および下表のクラス。

**クラスで置き方が決まるウィジェット**（`layout` を書けない）:

| クラス | 子の `placement` の意味 |
|---|---|
| `ttk.Notebook` | タブのオプション（`notebook.add(child, ...)`） |
| `ttk.PanedWindow` | ペインのオプション（`panedwindow.add(child, ...)`） |

- 子を持てないクラスに `children` または `layout` を書くとエラー。
- layout で子を並べるクラスが子を持つのに `layout` がない場合はエラー。

### 7.2 placement（子が親の中でどこに置かれるか）

どのキーを書けるかは**親**によって決まる。省略した場合は Tk の既定値で配置する。

| 親 | 書けるキー |
|---|---|
| pack | `side`（top/bottom/left/right）、`fill`（none/x/y/both）、`expand`、`anchor`、`padx`、`pady`、`ipadx`、`ipady` |
| grid | `row`、`column`、`rowspan`、`columnspan`、`sticky`、`padx`、`pady`、`ipadx`、`ipady` |
| place | `x`、`y`、`relx`、`rely`、`width`、`height`、`relwidth`、`relheight`、`anchor`、`bordermode`（inside/outside/ignore） |
| ttk.Notebook | `text`、`underline`、`sticky`、`padding`、`state`（normal/disabled/hidden） |
| ttk.PanedWindow | `weight` |

- `padx` / `pady`: 数値（両側同じ）または `[前, 後]`。
- `sticky`: `n` `s` `e` `w` の重複しない組み合わせ（例: `"nsew"`）。
- `anchor`: `n` `ne` `e` `se` `s` `sw` `w` `nw` `center`。
- `padding`（タブ）: 数値、`[横, 縦]`、または `[左, 上, 右, 下]`。

ルートノードは `placement` を持たない。

## 8. bindings

```json
"bindings": [{ "sequence": "<Return>", "handler": "on_name_return" }]
```

| キー | 説明 |
|---|---|
| `sequence` | Tk のイベントシーケンス。`<...>` 形式（仮想イベント `<<ComboboxSelected>>` 等も可） |
| `handler` | 呼び出すメソッド名 |

`command` と `bind` の違いと使い分けは [dsl-design-notes.md](dsl-design-notes.md)「イベントの扱い」を参照。

## 9. 名前（識別子）

`id`、変数名、ハンドラ名は生成コードのクラスメンバ名になるため、次を満たす必要がある。

- 英字・数字・`_` のみで、数字で始まらない（ASCII のみ）
- C++ と Python のキーワードでない
- `tkd_` で始まらない（予約メソッド用。codegen-design.md M6）
- `__` を含まず、`_` + 大文字で始まらない（C++ の予約名）
- ウィジェット・変数・ハンドラの**すべてを通して重複しない**。ただし同じハンドラを複数箇所から参照するのはよい

### ハンドラのシグネチャ

ハンドラのシグネチャは、どこから参照されたかで決まる。同じハンドラを異なるシグネチャで使うとエラーになる。

| 参照元 | シグネチャ |
|---|---|
| `bindings` | イベントを1つ受け取る |
| `command`（Scale） | 現在値を1つ受け取る |
| `command`（その他） | 引数なし |

## 10. 正規形

拡張がファイルを保存するときは次の形式で書き出す。同じ内容なら常に同じテキストになり、1回の操作による差分が最小になる（ADR 0006）。

- インデントは空白2つ、ファイル末尾に改行1つ。
- オブジェクトのキーは種類ごとに決まった順序で並べる（例: ノードは `id`, `class`, `window`, `options`, `layout`, `placement`, `bindings`, `children`）。
  順序の定義は [serialize.ts](../packages/core/src/dsl/serialize.ts) の `KEY_ORDER`。
- 名前がキーになるオブジェクト（`variables`、`options`、`columns`、`rows`）はキーの辞書順（数字は数値順）。
- プリミティブだけの配列（`[4, 8]`、`["Arial", 12]` 等）は1行で書く。

手で編集したファイルが正規形でなくても読み込める。

## 11. 検証と診断

検証は2段階で行い、結果は「診断」として返す（ADR 0009）。診断は JSON 上の位置（例: `["root", "children", 2, "placement", "row"]`）を持つ。

| 段階 | コード | 重大度 | 内容 |
|---|---|---|---|
| 読み込み | `json-syntax` | エラー | JSON として不正 |
| | `unsupported-version` | エラー | 未対応の `formatVersion` |
| 構造 | `schema` | エラー | 形・型・列挙値の誤り |
| 意味 | `invalid-identifier` | エラー | §9 の条件を満たさない名前 |
| | `duplicate-name` | エラー | 名前の重複 |
| | `unknown-class` | エラー | カタログにないクラス |
| | `unknown-option` | エラー | そのクラスにないオプション |
| | `option-alias` | エラー | オプションを別名で書いた |
| | `invalid-option-value` | エラー | オプションの型に合わない値 |
| | `unknown-variable` | エラー | 未定義の変数への参照 |
| | `variable-type-mismatch` | エラー | オプションが受け付けない型の変数 |
| | `misplaced-reference` | エラー | 参照を書けないオプションに参照を書いた |
| | `reference-required` | エラー | 参照が必須のオプションにリテラルを書いた |
| | `handler-signature-conflict` | エラー | 同じハンドラを異なるシグネチャで使った |
| | `invalid-child-class` | エラー | Tk / Toplevel をルート以外に置いた |
| | `layout-not-allowed` | エラー | 子を持てない、または置き方がクラスで決まるウィジェットに layout を書いた |
| | `children-not-allowed` | エラー | 子を持てないウィジェットに children を書いた |
| | `missing-layout` | エラー | 子を持つのに layout がない |
| | `placement-mismatch` | エラー | 親の置き方に合わない placement |
| | `unused-variable` | 警告 | どこからも参照されていない変数 |

構造の検証でエラーがあると意味の検証は行わない。

## 12. 今後の拡張（formatVersion 1 の範囲外）

- 画像（`PhotoImage`）・フォントオブジェクト・ttk スタイルの定義と参照
- Menu（メニューバー・コンテキストメニュー）
- Canvas のアイテム
- `tk.PanedWindow`（classic）のペインのオプション
- `validatecommand`、`xscrollcommand` 等、`command` 以外のコールバックオプション
- 生成されるクラス名の指定（現状は codegen 側で決める）
