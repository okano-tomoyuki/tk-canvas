# 0005. pnpm workspaces によるモノレポと開発ツールチェーン

- 状態: 承認
- 日付: 2026-09-24

## 背景

VS Code に依存しないコア（DSL・検証・コード生成）を、拡張・Webview・CLI から共有する（ADR 0001, 0002）。
複数パッケージを1リポジトリで管理する仕組みと、ビルド・テストの道具を決める必要がある。

## 検討した選択肢

### パッケージマネージャ

- **npm workspaces**: 追加ツール不要。ただし依存がルートの node_modules に巻き上げられるため、
  package.json に書いていない依存を誤って import できてしまう（幽霊依存）。パッケージ境界が崩れても気づきにくい。
- **pnpm workspaces**: 依存が厳密に分離され、宣言していない依存は import できない。インストールが高速で、ディスク効率が良い。
  `workspace:*` プロトコルでパッケージ間の依存を明示できる。モノレポでの採用例が多い。
  欠点として、VS Code 拡張のパッケージング（vsce）はシンボリックリンク構造の node_modules と相性が悪い。

### ビルド・テスト

- Webview（React）: Vite
- 拡張ホスト・CLI: esbuild でバンドル
- テスト: Vitest

## 決定

- **pnpm workspaces を採用する。** パッケージ境界（core は VS Code / DOM / Node に依存しない、等）を依存関係のレベルで守れることを重視する。
  vsce との相性の問題は、拡張を esbuild で1ファイルにバンドルし `vsce package --no-dependencies` で梱包することで回避する。
- ビルド・テストは **Vite（Webview）/ esbuild（拡張・CLI）/ Vitest** とする。
- 共通設定: TypeScript は `strict`、ESLint（flat config + typescript-eslint）、Prettier。

## 影響

- 開発者は pnpm のインストールが必要（Node.js 同梱の corepack で有効化できる）。
- パッケージ構成は [architecture.md](../architecture.md) を参照。
