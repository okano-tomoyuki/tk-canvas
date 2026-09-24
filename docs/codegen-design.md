# コード生成設計

[ADR 0004](adr/0004-marker-based-codegen.md) のマーカー区間更新方式を具体化する。

## 1. 生成の流れ

```
DSL (.tkui.json)
  └─ 検証（JSON Schema + ウィジェットカタログ + ハンドラのシグネチャ）
       └─ 中間表現（言語非依存: 生成・設定・配置・バインドの操作列）
            ├─ C++ エミッタ (cpp_tk)  → 区間ごとのコード片
            └─ Python エミッタ (tkinter) → 区間ごとのコード片
                 └─ マージ: 既存ファイルが無ければ雛形を生成、あればマーカー区間だけを置換
```

**生成の単位**: 1つの DSL ファイル = 1ウィンドウ = 1クラス（M9 で決定）。

## 2. マーカー区間

| 区間 | 内容 | C++ の置き場所 | Python の置き場所 |
|---|---|---|---|
| ① 宣言部 | 全ウィジェット・全変数の宣言、予約メソッドの宣言、**ハンドラの宣言** | ヘッダ（クラス定義内） | `__init__` 冒頭 |
| ②A 生成 | インスタンス化・親子関係・オプション設定 | .cpp（`tkd_create_widgets`） | クラス内メソッド |
| ②B 配置 | pack / grid / place、Notebook の add 等、コンテナ側設定（rowconfigure 等） | .cpp（`tkd_apply_layout`） | クラス内メソッド |
| ②C イベント | command の設定、bind の登録 | .cpp（`tkd_bind_events`） | クラス内メソッド |

予約メソッドには接頭辞 `tkd_` を付け、ユーザーのメソッドとの名前衝突を避ける（M6 で決定）。

### マーカー書式

```
// <tk-designer:begin id="tkd_create_widgets">
...
// <tk-designer:end id="tkd_create_widgets" hash="3f9a1c...">
```

- Python では `#` コメントを使う。
- `id` で区間を識別する。ユーザーが区間の位置や順序を動かしてもよい。
- `hash` は区間内容のハッシュ値。手編集の検出に使う（M2 で決定、§4 参照）。

## 3. 生成例

以下の DSL を対象とする（抜粋）。

- 変数 `user_name`（StringVar）
- ウィンドウ `main_window`（grid、列1を伸縮）
- `name_entry`（ttk.Entry、`textvariable` = `user_name`、`<Return>` → `on_name_return`）
- `submit_button`（ttk.Button、`command` → `on_submit`）

### C++ (cpp_tk)

`main_window.hpp`

```cpp
#pragma once
#include "cpp_tk.hpp"

class MainWindow
{
public:
    MainWindow();
    void run();

private:
    // <tk-designer:begin id="declarations">
    cpp_tk::Tk main_window;
    cpp_tk::StringVar user_name;
    cpp_tk::ttk::Entry name_entry;
    cpp_tk::ttk::Button submit_button;

    void tkd_create_widgets();
    void tkd_apply_layout();
    void tkd_bind_events();

    void on_submit();
    void on_name_return(const cpp_tk::Event& event);
    // <tk-designer:end id="declarations" hash="...">

    int submit_count_ = 0;
};
```

`main_window.cpp`

```cpp
#include "main_window.hpp"

namespace tk  = cpp_tk;
namespace ttk = cpp_tk::ttk;

MainWindow::MainWindow()
{
    tkd_create_widgets();
    tkd_apply_layout();
    tkd_bind_events();
}

void MainWindow::run()
{
    main_window.mainloop();
}

// <tk-designer:begin id="tkd_create_widgets">
void MainWindow::tkd_create_widgets()
{
    main_window.title("Sample");
    main_window.geometry("400x300");

    name_entry = ttk::Entry(main_window.as_parent(), {{"textvariable", user_name}});
    submit_button = ttk::Button(main_window.as_parent(), {{"text", "OK"}});
}
// <tk-designer:end id="tkd_create_widgets" hash="...">

// <tk-designer:begin id="tkd_apply_layout">
void MainWindow::tkd_apply_layout()
{
    main_window.grid_columnconfigure(1, {{"weight", 1}});

    name_entry.grid({{"row", 0}, {"column", 1}, {"sticky", "ew"}});
    submit_button.grid({{"row", 1}, {"column", 1}, {"sticky", "e"}});
}
// <tk-designer:end id="tkd_apply_layout" hash="...">

// <tk-designer:begin id="tkd_bind_events">
void MainWindow::tkd_bind_events()
{
    submit_button.command([this]() { on_submit(); });
    name_entry.bind("<Return>", [this](const tk::Event& event) { on_name_return(event); });
}
// <tk-designer:end id="tkd_bind_events" hash="...">

// <tk-designer:handler-stubs>

void MainWindow::on_submit()
{
    // TODO: 実装
}

void MainWindow::on_name_return(const tk::Event& event)
{
    // TODO: 実装
}
```

#### cpp_tk 固有の注意点

- **親の指定は常に `as_parent()` を経由する。**
  ウィジェット型は move 代入に対応しているため、既定構築したメンバに後から `x = ttk::Entry(...)` と代入できる。
  ただし親と子が同じ型のとき（例: Frame の中の Frame）、`ttk::Frame(parent_frame)` は「親の指定」と「コピー/ムーブ構築」の区別がつかない。
  生成コードは型の組み合わせによらず一律に `parent.as_parent()` を使い、この曖昧さを避ける。
- **変数の型はデザイナー側で制限する。**
  cpp_tk ではオプションの map に任意の Variable を渡せてしまうため、ウィジェットカタログで「オプションごとに受け付ける変数型」を定義し、
  DSL の検証とプロパティエディタの候補表示で制限する（例: `textvariable` は StringVar のみ）。
- **メンバの宣言順 = 構築順。** `Tk` メンバは他のすべてのメンバより先に宣言する（宣言部の出力順で保証する）。

### Python (tkinter)

```python
import tkinter as tk
from tkinter import ttk


class MainWindow:
    def __init__(self):
        # <tk-designer:begin id="declarations">
        self.main_window: tk.Tk
        self.user_name: tk.StringVar
        self.name_entry: ttk.Entry
        self.submit_button: ttk.Button
        # <tk-designer:end id="declarations" hash="...">

        self.tkd_create_widgets()
        self.tkd_apply_layout()
        self.tkd_bind_events()

        self.submit_count = 0

    # <tk-designer:begin id="tkd_create_widgets">
    def tkd_create_widgets(self):
        self.main_window = tk.Tk()
        self.main_window.title("Sample")
        self.main_window.geometry("400x300")

        self.user_name = tk.StringVar(master=self.main_window, value="")

        self.name_entry = ttk.Entry(self.main_window, textvariable=self.user_name)
        self.submit_button = ttk.Button(self.main_window, text="OK")
    # <tk-designer:end id="tkd_create_widgets" hash="...">

    # <tk-designer:begin id="tkd_apply_layout">
    def tkd_apply_layout(self):
        self.main_window.grid_columnconfigure(1, weight=1)

        self.name_entry.grid(row=0, column=1, sticky="ew")
        self.submit_button.grid(row=1, column=1, sticky="e")
    # <tk-designer:end id="tkd_apply_layout" hash="...">

    # <tk-designer:begin id="tkd_bind_events">
    def tkd_bind_events(self):
        self.submit_button.configure(command=self.on_submit)
        self.name_entry.bind("<Return>", self.on_name_return)
    # <tk-designer:end id="tkd_bind_events" hash="...">

    def run(self):
        self.main_window.mainloop()

    # <tk-designer:handler-stubs>

    def on_submit(self):
        pass

    def on_name_return(self, event):
        pass
```

## 4. 決定事項

| # | 論点 | 決定 |
|---|---|---|
| M1 | ハンドラの宣言・実装の置き場所 | **宣言は区間①に含める。実装の雛形はユーザー領域に追記のみ行い、削除はしない。** DSL からハンドラが消えると、C++ では宣言が消えて実装がコンパイルエラーになるので、削除漏れに気づける。Python にはメソッドの宣言がないため同じ効果はなく、未使用になったハンドラは警告で知らせる。 |
| M2 | 区間内の手編集の検出 | **終了マーカーに区間内容のハッシュを持たせる。** 再生成時に不一致なら、上書き前に警告・確認する。 |
| M6 | 予約メソッド名 | **接頭辞 `tkd_` を付ける**（`tkd_create_widgets` / `tkd_apply_layout` / `tkd_bind_events`）。 |
| M9 | 生成ファイルの単位 | **1つの DSL ファイル = 1ウィンドウ = 1クラス。** |

## 5. 未決の論点

| # | 論点 | 案 |
|---|---|---|
| M3 | フォーマッタとの共存 | ハッシュ方式（M2）を採ったので、clang-format / black が区間を整形するとハッシュが変わり、誤って警告してしまう。案: ハッシュは**空白を正規化した上で**計算する（文字列リテラル内は除く）。改行・インデントの変更は無視できるが、フォーマッタがトークン自体を変える場合（末尾カンマの追加、クォートの統一など）は検出されてしまう。black の場合は、生成コードを最初から black 準拠の書式で出力して吸収する。 |
| M4 | 異常系 | マーカーの欠落・重複・入れ子・begin/end の不一致は、**何も書き込まずにエラー**とする（部分的に書き換えない）。 |
| M5 | ハンドラのシグネチャ検証 | `command` のシグネチャはウィジェットクラスごとにカタログで定義する（Button: 引数なし、Scale: 値を受け取る 等）。`bind` は常にイベント引数を1つ受け取る。同じハンドラ名を異なるシグネチャで使ったら DSL の検証エラーとする。 |
| M7 | ウィジェット id の変更 | 宣言が変わり、ユーザー領域の参照が壊れる。初期は警告のみとし、将来的にリネームとの連動を検討する。 |
| M8 | VS Code 上での書き込み | ファイルを直接書き換えず **WorkspaceEdit** で適用する。未保存のバッファにも正しく反映され、Undo も効く。 |
| M10 | ハンドラ雛形の追記位置 | 雛形の初回生成時に1行マーカー `<tk-designer:handler-stubs>` を置き、その直後に追記する。マーカーが見つからなければ、C++ ではファイル末尾、Python ではクラス末尾に追記する。実装済みかどうかは、C++ では `MainWindow::on_submit(`、Python では `def on_submit(` の有無で判定する。 |
