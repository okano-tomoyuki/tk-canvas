# DSL 設計検討メモ

正式仕様（[dsl-spec.md](dsl-spec.md)）を作る前の検討メモ。**合意内容は dsl-spec.md に反映済みで、以降は dsl-spec.md を正とする。**
ドラフト（[drafts/schema.json](drafts/schema.json) / [drafts/codegen.py](drafts/codegen.py)）のレビュー結果と、決めるべき論点を記録する。

## 1. ドラフトの評価

### 良い点（引き継ぐ）

- **ウィジェットツリー構造**（`children` の再帰）。Tk の親子関係をそのまま表現できる。
- **ジオメトリマネージャをコンテナ側で決める**（`layoutPolicy`）。
  Tk では同じ親の中で `pack` と `grid` を混在できないため、この制約を構造で表現できている。
- **`id` が生成コードのメンバ名になる**。生成コードが読みやすい。
- **イベントはハンドラ名で参照し、処理本体は DSL に書かない**。
- **生成コードで「生成」「配置」「イベント」の段階を分けている**。

### 課題

| # | 課題 | 詳細 |
|---|---|---|
| 1 | `layoutPolicy` の適用先が曖昧 | `codegen.py` の `gen_layout` では、ノード自身の `layoutPolicy` がそのノード自身の配置にも使われる。例えば `pack` の親の中で `layoutPolicy: grid` を持つ Frame は、自身が `.grid()` で配置されてしまう。**自分の配置は親のマネージャで決まり、自分の `layoutPolicy` は子に対してだけ効く**、が正しい。 |
| 2 | `layout` が全マネージャ分の値を同時に持てる | `layout.pack` と `layout.grid` を併記でき、どちらが有効なのかが親次第になる。無効な値がファイルに残る。 |
| 3 | コンテナ側の設定がない | `grid_rowconfigure` / `grid_columnconfigure`（weight, minsize, uniform）、`pack_propagate` / `grid_propagate` がない。grid でウィンドウリサイズに追従させるには必須。 |
| 4 | ttk と classic の区別がない | `type: "Button"` が `tk.Button` なのか `ttk.Button` なのか区別できない。 |
| 5 | `events.onClick` が Tk の概念ではない | Tk には「`command` オプション」（Button, Checkbutton, Scale, Spinbox 等、ウィジェットにより引数が異なる）と「`bind` によるイベントシーケンス」（`<Button-1>`, `<Return>`, `<<ComboboxSelected>>` 等）の2系統がある。 |
| 6 | 変数（`StringVar` 等）がない | Entry の `textvariable`、Radiobutton のグループ化（同じ `variable` を共有）に必須。 |
| 7 | プロパティ値の型が曖昧 | 文字列・数値のほかに、変数参照・ハンドラ参照・画像参照・フォント・複合値（`padx=(4, 8)` のようなタプル）がある。値の種類を区別できないと、正しくコード生成・検証ができない。 |
| 8 | 配置が pack/grid/place 以外のウィジェットがある | Notebook のタブ（`notebook.add(child, text=...)`）や PanedWindow のペインは、ジオメトリマネージャではなく親のメソッドで子を登録する。Menu もツリー外の特殊な構造を持つ。 |
| 9 | root が「ウィンドウ直下の1ウィジェット」 | ウィンドウ（`Tk` / `Toplevel`）自体がコンテナであり、そこに直接子を並べられる方が自然。 |
| 10 | バージョン情報がない | 将来の形式変更時にマイグレーションできるよう、フォーマットバージョンが必要。 |
| 11 | プロパティがウィジェットごとに検証されない | `properties` は任意のオブジェクト。ウィジェットカタログから、クラスごとのオプション定義を生成して検証したい。 |

### codegen.py について

- 実装は TypeScript のコアパッケージで行う予定なので、`codegen.py` は**出力イメージのすり合わせ用**として扱う。
- `dict_to_args` は Python のリテラル表現（`True` など）に依存しており、C++ では使えない。
  言語非依存の中間表現を挟み、エスケープや真偽値の表記は各言語のエミッタで行う（ADR 0002）。
- イベントスタブが生成クラスの中にあるため、再生成するとユーザーが書いた処理が消える。
  → マーカー区間の更新方式で解決する（[ADR 0004](adr/0004-marker-based-codegen.md)、[codegen-design.md](codegen-design.md)）。

## 2. 改訂案（たたき台）

課題を反映した記述例。名前や細部は議論で詰める。

```jsonc
{
  "formatVersion": 1,

  // 変数（StringVar / IntVar / DoubleVar / BooleanVar）
  "variables": {
    "user_name": { "type": "StringVar", "value": "" },
    "mode":      { "type": "IntVar",    "value": 0 }
  },

  // ルートはウィンドウそのもの
  "root": {
    "id": "main_window",
    "class": "Tk",
    "window": { "title": "Sample", "geometry": "400x300", "resizable": [true, true] },

    // 子に対する配置方針（課題 1, 3）
    "layout": {
      "manager": "grid",
      "columns": { "1": { "weight": 1 } },
      "rows":    { "2": { "weight": 1 } }
    },

    "children": [
      {
        "id": "name_label",
        "class": "ttk.Label",                    // 課題 4: 名前空間つきクラス名
        "options": { "text": "Name:" },
        "placement": { "row": 0, "column": 0, "sticky": "w", "padx": [8, 4] }   // 課題 2: 親の manager に応じた1種類だけ
      },
      {
        "id": "name_entry",
        "class": "ttk.Entry",
        "options": {
          "textvariable": { "var": "user_name" }   // 課題 6, 7: 参照は型つきオブジェクト
        },
        "placement": { "row": 0, "column": 1, "sticky": "ew" },
        "bindings": [                              // 課題 5: bind
          { "sequence": "<Return>", "handler": "on_submit" }
        ]
      },
      {
        "id": "submit_button",
        "class": "ttk.Button",
        "options": {
          "text": "OK",
          "command": { "handler": "on_submit" }    // 課題 5: command はオプションの1つ
        },
        "placement": { "row": 1, "column": 1, "sticky": "e" }
      },
      {
        "id": "tabs",
        "class": "ttk.Notebook",
        "placement": { "row": 2, "column": 0, "columnspan": 2, "sticky": "nsew" },
        // 課題 8: Notebook の子は layout 不要。placement はタブのオプションになる
        "children": [
          {
            "id": "general_page",
            "class": "ttk.Frame",
            "placement": { "text": "General" },
            "layout": { "manager": "pack" },
            "children": []
          }
        ]
      }
    ]
  }
}
```

### 用語の整理（案）

| 用語 | 意味 | 置き場所 |
|---|---|---|
| `layout` | このコンテナが**子をどう並べるか**（manager と行・列設定） | コンテナ |
| `placement` | この子が**親の中でどこに置かれるか**（親の manager に応じた引数） | 子 |
| `options` | Tk のウィジェットオプション（`configure` で設定できるもの） | 各ウィジェット |
| `window` | `wm` 系の設定（title, geometry, resizable 等） | Tk / Toplevel |

「親の種類によって `placement` の意味が決まる」と一般化すると、pack / grid / place / Notebook タブ / PanedWindow ペインを同じ仕組みで扱える。

→ **方向性は合意済み**（2026-09-24）。`bindings` も同じ整理に含める（下表に追加）。

| 用語 | 意味 | 置き場所 |
|---|---|---|
| `bindings` | `bind` によるイベントシーケンスとハンドラの対応 | 各ウィジェット |

### イベントの扱い（command と bind）

`bind` はすべてのウィジェットに適用できるので、**プロパティエディタでは `bindings` を編集の中心に置く**。
ただし `command` でしか得られない挙動があるので、`command` も併せて扱う。

| 観点 | `command` | `bind("<Button-1>")` |
|---|---|---|
| キーボード操作（Space キー、`invoke()`） | 発火する | 発火しない |
| `state=disabled` のとき | 発火しない | **発火する** |
| 発火タイミング | ボタンを離したとき（ボタン外で離せばキャンセル） | 押した瞬間 |
| Checkbutton / Radiobutton | 変数の更新**後**に発火 | 変数の更新**前**に発火 |
| Scale / Spinbox | 現在値などを受け取れる | 値は自分で取得する |

このため、ボタン類の「クリック時の処理」を `<Button-1>` で代用すると、Tk の標準的な挙動から外れる。

UI の方針（案）:

- プロパティパネルに「イベント」タブを設け、`command`（そのウィジェットが持つ場合のみ）と `bindings` を一覧で編集する。
- シーケンスはウィジェットカタログから候補を出す（`<<ComboboxSelected>>`、`<<ListboxSelect>>`、`<<NotebookTabChanged>>` などの仮想イベントも含む）。自由入力も許す。
- DSL 上の `command` は `options.command: { "handler": "..." }` のまま（Tk ではオプションの一つのため）。UI 上の見せ方とは分けて考える。
- ハンドラは登録時にシグネチャを検証する（[codegen-design.md](codegen-design.md) M5）。

## 3. 論点（要相談）

| # | 論点 | 選択肢 | 現時点の推し / 結論 |
|---|---|---|---|
| D1 | ファイル形式 | JSON / YAML / 独自書式 | **決定: JSON**。VS Code の JSON Schema 補完・検証がそのまま使え、パーサも標準で揃う。手で書くことより「差分が読める」ことを重視する。 |
| D2 | 参照値の表記 | `{ "var": "x" }` のような型つきオブジェクト / `"@x"` のような文字列の接頭辞 | **決定: 型つきオブジェクト**。リテラル文字列と取り違えない。ハンドラ参照は登録時のシグネチャ検証に使う。 |
| D3 | ウィジェットカタログの作り方 | 手書き / Tk から自動抽出 / cpp_tk のヘッダから抽出 | **決定: Tk から自動抽出 + 手書きの補足情報**（[ADR 0007](adr/0007-widget-catalog-from-tk.md)）。カタログには少なくとも、オプションの値の型、**変数参照を受け付けるオプションとその変数型**（例: `textvariable` は StringVar のみ。cpp_tk では型で制限されないため、デザイナー側で制限する）、`command` のシグネチャ、代表的な bind シーケンスを持たせる。 |
| D4 | 子の並び順 | `children` 配列の順序 = 生成順・pack 順 | pack はこの順序が配置結果に影響するので、配列順を正とする。 |
| D5 | Menu・Canvas アイテム・画像リソースの扱い | 初期スコープに入れるか | 初期スコープ外とし、構造上追加できる余地だけ残す案。 |
| D6 | ファイル拡張子 | `.tkui.json` / `.tkui` | `.tkui.json` なら JSON として扱われやすい。Custom Editor の関連付けとあわせて検討する。 |
| D7 | 生成コードの構成 | ベースクラス継承 / 部分生成（マーカー区間の書き換え） | **決定: マーカー区間の更新方式**（[ADR 0004](adr/0004-marker-based-codegen.md)）。ユーザー体験を優先する。 |
