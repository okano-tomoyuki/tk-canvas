# tk-designer ドキュメント

Tcl/Tk 向け GUI デザイナー（VS Code 拡張）の設計ドキュメント群。
旧実装およびその仕様には縛られず、ここに記録された合意事項を正とする。

## 構成

| ドキュメント | 内容 | 状態 |
|---|---|---|
| [vision.md](vision.md) | 目的・想定ユーザー・スコープ | 初版 |
| [development.md](development.md) | 開発手順（環境・コマンド・デバッグ実行とトラブル対処） | 初版 |
| [adr/](adr/) | 設計判断の記録（1判断1ファイル） | 随時追加 |
| [dsl-design-notes.md](dsl-design-notes.md) | DSL 設計の検討メモ（ドラフトのレビュー・論点） | 完了（dsl-spec.md に反映済み） |
| [codegen-design.md](codegen-design.md) | コード生成（マーカー区間更新）の設計・生成例・実装 | Python・C++ 実装済み |
| [dsl-spec.md](dsl-spec.md) | DSL 正式仕様（formatVersion 1） | 初版 |
| [catalog.md](catalog.md) | ウィジェットカタログ（抽出・型推定・補足情報・更新手順） | 初版（補足は 23 クラス） |
| [editing.md](editing.md) | 編集基盤（編集コマンド・拡張と Webview の同期） | 初版 |
| [layout.md](layout.md) | レイアウトエンジン（pack / grid / place の移植と Tk との比較検証）・キャンバス表示 | 初版（要求サイズの推定は暫定） |
| [architecture.md](architecture.md) | パッケージ構成・データフロー・技術スタック | 初版（A3〜A5 は未決） |
| [drafts/](drafts/) | DSL・コード生成の初期ドラフト（すり合わせ用の参考資料） | 参考 |
| requirements.md | 機能要件・非機能要件 | 未着手 |

## ADR 一覧

| No. | タイトル | 状態 |
|---|---|---|
| [0001](adr/0001-vscode-extension.md) | 製品形態として VS Code 拡張を採用する | 承認 |
| [0002](adr/0002-codegen-targets.md) | 生成ターゲットを cpp_tk と Python tkinter の2系統とする | 承認 |
| [0003](adr/0003-react-for-webview.md) | Webview UI に React を採用する | 承認 |
| [0004](adr/0004-marker-based-codegen.md) | 生成コードはマーカー区間の更新方式とする | 承認 |
| [0005](adr/0005-monorepo-and-toolchain.md) | pnpm workspaces によるモノレポと開発ツールチェーン | 承認 |
| [0006](adr/0006-document-state-and-undo.md) | 状態管理と Undo/Redo: テキスト文書を唯一の正とし、Undo は VS Code に委ねる | 承認 |
| [0007](adr/0007-widget-catalog-from-tk.md) | ウィジェットカタログは Tk から自動抽出し、手書きの補足情報を重ねる | 承認 |
| [0008](adr/0008-layout-engine-in-core.md) | キャンバス上のレイアウトは Tk のアルゴリズムを TypeScript で再現して計算する | 承認 |
| [0009](adr/0009-dsl-schema-in-zod.md) | DSL のスキーマは Zod で TS 側に定義し、型と JSON Schema を導出する | 承認 |
| [0010](adr/0010-codegen-config-and-trigger.md) | コード生成の設定は DSL に持ち、生成は利用者の明示的な操作で行う | 承認 |
| [0011](adr/0011-root-as-base-class.md) | 生成するクラスはルートのクラスを継承する（is-A） | 承認 |

## 旧実装

旧実装は `legacy` ブランチ／`legacy-v0` タグに退避済み。master は作り直す。

新しい ADR は [adr/template.md](adr/template.md) をコピーして作成する。
