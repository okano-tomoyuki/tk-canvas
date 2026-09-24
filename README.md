# tk-designer

Tcl/Tk 向け GUI デザイナー（VS Code 拡張）。1つの画面定義（`*.tkui.json`）から
[cpp_tk](https://github.com/okano-tomoyuki/cpp_tk)（C++）と Python tkinter のコードを生成する。

> 再構築中。設計は [docs/](docs/README.md) を参照。旧実装は `legacy` ブランチにある。

## 開発環境

- Node.js 24 以上
- pnpm（`corepack enable pnpm` で有効化。バージョンは `package.json` の `packageManager` で固定）

```sh
pnpm install
pnpm build        # webview / extension / cli をビルド
pnpm check        # 型検査・lint・整形チェック・テストをまとめて実行
```

VS Code で本リポジトリを開き、F5（Run Extension）で拡張を起動すると、`samples/` が開いた状態の開発用ウィンドウが立ち上がる。
`samples/hello.tkui.json` を開くとデザイナーが表示される。詳しくは [docs/development.md](docs/development.md)。

## 構成

| パス                 | 内容                                                              |
| -------------------- | ----------------------------------------------------------------- |
| `packages/core`      | DSL の型・検証・ドキュメント操作・拡張と Webview 間のメッセージ型 |
| `packages/codegen`   | コード生成（C++ / Python）                                        |
| `packages/cli`       | コード生成 CLI（`tkd`）                                           |
| `packages/extension` | VS Code 拡張ホスト                                                |
| `packages/webview`   | デザイナー UI（React）                                            |
| `docs/`              | 設計ドキュメント・ADR                                             |
