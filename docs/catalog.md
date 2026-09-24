# ウィジェットカタログ

ウィジェットクラスごとのオプション・型・子の置き方などを定義するデータ。方針は [ADR 0007](adr/0007-widget-catalog-from-tk.md)。
プロパティエディタの構築、DSL の検証（[dsl-spec.md](dsl-spec.md) §6, §11）、コード生成で使う。

## 1. 構成

```
tools/catalog/extract.tcl            … Tk から抽出するスクリプト（開発時のみ実行）
        │  tclsh で実行
        ▼
packages/core/src/catalog/tk-raw.json … 抽出結果（生成物。コミットする）
        │
        ├─ infer.ts    … エラーメッセージ・データベースクラス名から値の型を推定
        ├─ overlay.ts  … 手書きの補足情報
        ▼
packages/core/src/catalog/catalog.ts … 両者を合成して WidgetCatalog を作る（getWidgetCatalog()）
```

## 2. 対象クラス

cpp_tk がカバーする 37 クラス（tkinter と同じクラス名）。

| ライブラリ | クラス |
|---|---|
| classic（`tk.`） | Tk, Toplevel, Frame, Button, Canvas, Checkbutton, Entry, Label, LabelFrame, Listbox, Menu, Menubutton, Message, PanedWindow, Radiobutton, Scale, Scrollbar, Spinbox, Text |
| ttk（`ttk.`） | Button, Checkbutton, Combobox, Entry, Frame, Label, Labelframe, Menubutton, Notebook, PanedWindow, Progressbar, Radiobutton, Scale, Scrollbar, Separator, Sizegrip, Spinbox, Treeview |

- `ttk.Labelframe` は cpp_tk・tkinter の名前に合わせる（tkinter には別名 `ttk.LabelFrame` もあるが、DSL では使わない）。
- cpp_tk の合成ウィジェット（ScrolledText, LabeledScale, Calendar）と `tk.OptionMenu` は Tk のクラスではないため対象外。扱いは別途検討する。

## 3. 抽出（extract.tcl）

各クラスのウィジェットを実際に生成し、`configure` の戻り値からオプション名・データベース名・データベースクラス名・既定値・別名を得る。
さらにオプションごとに**新しいウィジェットを生成して**次の2つを試し、Tk の応答をそのまま記録する
（不正な値の設定に失敗したウィジェットは内部状態が壊れることがあるため、使い回さない）。

| 試すこと | 記録 | 使い道 |
|---|---|---|
| 現在値を設定し直す | 失敗したら `creationOnly: true` とエラーメッセージ | 生成時にしか指定できないオプション（`class`, `container` 等）の判定 |
| 不正な値 `__tkd_invalid__` を設定する | エラーメッセージ（`probeError`。成功したら空） | 値の型・列挙値の推定 |

ルート（`.`）は作り直せないため、オプション一覧は `.` から取り、試行は同じオプションを持つ `toplevel` で行う。

## 4. 型の推定（infer.ts）

| 手がかり | 型 |
|---|---|
| `unknown color name` | color |
| `bad screen distance` | distance |
| `expected integer` / `expected floating-point number` / `expected boolean value` | integer / number / boolean |
| `bad cursor spec` / `image ... doesn't exist` / `bitmap ... not defined` | cursor / image / bitmap |
| `Layout ... not found` | style（ttk のスタイル名） |
| `bad window path name` | window |
| `bad <名前> "...": must be a, b, or c` | enum（候補 a, b, c） |
| エラーなし + データベースクラス `Font` | font |
| エラーなし + データベースクラス `Variable` | variable（全変数型） |
| エラーなし + データベースクラス `*Command` | callback（シグネチャ未定義） |
| 上記以外 | string |

## 5. 補足情報（overlay.ts）

| 項目 | 内容 |
|---|---|
| `category` | パレットでの分類（window / container / basic / input / selection / display / other） |
| `children` | 子の置き方（`layout` / `notebook` / `paned`）。未指定は子を持てない |
| `commonOptions` | プロパティエディタで優先して表示するオプション |
| `events` | bind シーケンスの候補（全クラス共通の候補に追加する） |
| `optionTypes` | 推定した型の上書き（変数型の限定、command のシグネチャ、ttk の state の候補など） |

- クラスを問わない上書き（`textvariable` / `listvariable` は StringVar のみ）は `GENERIC_OPTION_TYPES` に書く。
- 補足情報のないクラスも抽出結果だけで使える（`curated: false`、分類 other、子を持てない）。
- 現在補足済み（23 クラス）: tk.Tk, tk.Toplevel, ttk.Frame, ttk.Labelframe, ttk.Notebook, ttk.PanedWindow, tk.Frame, tk.LabelFrame,
  ttk.Button, ttk.Label, ttk.Separator, ttk.Progressbar, ttk.Scrollbar, ttk.Entry, ttk.Spinbox, ttk.Scale, tk.Text,
  ttk.Checkbutton, ttk.Radiobutton, ttk.Combobox, tk.Listbox, ttk.Treeview, tk.Canvas
- 補足情報が参照するクラス・オプションが実在することはテストで検査する（綴り誤りの検出）。

## 6. 更新手順

Tk のバージョンを上げたときや、抽出方法を変えたときに実行する。

```sh
# Tk 入りの tclsh が PATH にあること（Windows では MSYS2 の mingw64/bin など）
pnpm catalog:extract
pnpm check
```

差分（`tk-raw.json`）を確認してコミットする。

## 7. 既知の制約・今後の課題

- 抽出環境は Tk 8.6.18 / win32。X11・aqua 固有のオプションの差や、Tk 9.0 との差は未確認。
- `scrollregion`、`format`（spinbox）、`padding`（ttk）など独特な形式のオプションは string として扱っている。必要に応じて補足情報で型を与える。
- `command` 以外のコールバック（`xscrollcommand`, `validatecommand` 等）は、シグネチャが未定義のためハンドラ参照にまだ対応していない。
- ttk の見た目に関わる設定の多くはスタイル（`ttk::style`）側にあり、カタログには含まれない（architecture.md A5）。
- 抽出結果（約 130KB）をそのまま Webview に同梱している。サイズが問題になれば、ビルド時に必要な項目だけへ圧縮する。
