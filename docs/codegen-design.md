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

## 5. 決定事項（続き、2026-09-25）

| # | 論点 | 決定 |
|---|---|---|
| M3 | フォーマッタとの共存 | ハッシュは**空白（改行・字下げを含む）を取り除いてから**計算する。フォーマッタによる改行や字下げの違いでは手編集とみなさない。 |
| M4 | 異常系 | マーカーの欠落・重複・入れ子・対応の誤りがあれば、**何も書き込まずにエラー**とする。 |
| M5 | ハンドラのシグネチャ | command はカタログのシグネチャ（Scale は値を受け取る）、bind はイベントを受け取る。異なるシグネチャでの使用は DSL の検証エラー。 |
| M7 | ウィジェット id の変更 | 警告のみとする方針（**未実装**。現状は区間外の参照は利用者が直す）。 |
| M8 | VS Code 上での書き込み | **WorkspaceEdit** で書き込む。書き込み前に未保存の変更がなかったファイルは、書き込み後に保存する。 |
| M10 | ハンドラ雛形の追記位置 | `<tk-designer:handler-stubs>` の直後に追記する。マーカーがなければ Python は `if __name__ == "__main__":` の手前（なければ末尾）。定義済みかは `def 名前(` の有無で判定する。 |

## 6. 実装

生成の設定と生成のきっかけは [ADR 0010](adr/0010-codegen-config-and-trigger.md)。

| ファイル | 内容 |
|---|---|
| [codegen/src/model.ts](../packages/codegen/src/model.ts) | 中間表現（ウィジェット・変数・イベント・ハンドラのシグネチャ） |
| [codegen/src/python/emit.ts](../packages/codegen/src/python/emit.ts) | Python: 区間の中身・新規ファイルの雛形・ハンドラの雛形 |
| [codegen/src/cpp/emit.ts](../packages/codegen/src/cpp/emit.ts) | C++: ヘッダ（宣言の区間）とソース（生成・配置・イベントの区間、ハンドラの雛形） |
| [codegen/src/region.ts](../packages/codegen/src/region.ts) | マーカー区間の書き出しと、既存のファイルへのマージ（言語共通） |
| [codegen/src/index.ts](../packages/codegen/src/index.ts) | `generateAll`: codegen に書かれたすべてのターゲットを生成する（拡張機能・CLI の共通の入口） |
| [codegen/src/__golden__/](../packages/codegen/src/__golden__/) | 生成結果のゴールデンファイル（テストで比較） |

生成の入口は、デザイナーの「コード生成」ボタン（拡張）と `tkd generate`（CLI）。codegen が未設定なら、ボタンでは生成する言語（Python / C++ / 両方）を選んで DSL に追加する。

### Python（tkinter）

- Python のキーワードと重なるオプション名は tkinter の慣習どおり末尾に `_` を付ける（`from` → `from_`、`class` → `class_`）。
- ルートが Toplevel の場合は `__init__(self, master)` とし、`run` と `if __name__ == "__main__":` は作らない。

### C++（cpp_tk）

- ハンドラの宣言はヘッダの宣言の区間に入る（M1）。実装の雛形はソースの `<tk-designer:handler-stubs>` の後に追記する（定義済みかは `クラス名::ハンドラ名(` の有無で判定）。
- 親は常に `as_parent()` で渡す。オプションは `std::map<std::string, ArgValue>` で渡し、変数は `ArgValue(Var&)` で名前として渡る。リストは `std::vector<tk::ArgValue>{...}`。
- command は `[this]() { h(); }`、Scale は `[this](const double& value) { h(value); }`、bind は `[this](const tk::Event& event) { h(event); }`。
- Notebook のタブは `add_tab(child, text)` の後、ラベル以外の指定を `tab(child.full_name(), {...})` で設定する。
- cpp_tk の `Tk()` は `geometry("300x300")` を設定するため、geometry が未指定なら `geometry("")` で要求サイズに戻す（Tkinter と同じ動作にする）。
- ルートが Toplevel の場合は、コンストラクタで親（`const cpp_tk::Widget&`）を受け取り、`run` は作らない。
- tk.Tk の生成時にしか指定できないオプション（class 等）は反映できないため、警告として知らせる。
- コールバックが this を捕捉するため、生成するクラスはコピーできない（コピーコンストラクタ・代入演算子を delete する）。
- `main` 関数は生成しない。利用側で `MainWindow ui; ui.run();` のように使う。

### 検証

生成したコードを実際に実行して確かめる（Python と C++ で同じ内容を検証する）。

| コマンド | 内容 |
|---|---|
| `pnpm codegen:verify-python` | 生成した Python を tkinter で実行（[verify-python.mts](../tools/codegen/verify-python.mts)） |
| `pnpm codegen:verify-cpp` | 生成した C++ を cpp_tk と一緒に CMake + Ninja でビルドして実行（[verify-cpp.mts](../tools/codegen/verify-cpp.mts)）。作業フォルダは `.cache/verify-cpp` |

1. レイアウトの検証データ（docs/layout.md）から生成したコードを実行し、全ウィジェットの位置と大きさが Tk の記録と一致すること（Python・C++ とも 5 フィクスチャ・39 ウィジェットで一致）。
2. 変数・command・bind が結び付いていること（ボタンの invoke、Scale の値の変更、Return キーでハンドラが呼ばれ、Radiobutton が変数を更新する）。
3. C++ のみ: ルートが Toplevel の場合に、親を受け取って表示され、ウィンドウの設定（title・geometry・resizable）が反映されること。

## 7. 未実装

- ウィジェット id の変更の警告（M7）、Python で使われなくなったハンドラの警告（M1）。
