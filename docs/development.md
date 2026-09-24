# 開発手順

## 1. 必要なもの

| もの | 用途 |
|---|---|
| Node.js 24 以上 | ビルド・テスト |
| pnpm（`corepack enable pnpm`。バージョンは `package.json` の `packageManager` で固定） | パッケージ管理 |
| Tk 入りの tclsh（Windows では MSYS2 の `mingw-w64-x86_64-tk` など） | ウィジェットカタログの抽出、レイアウトの検証データの記録のみ |
| tkinter の使える Python | 生成したコードの検証のみ |

## 2. よく使うコマンド

| コマンド | 内容 |
|---|---|
| `pnpm install` | 依存関係のインストール |
| `pnpm build` | webview / extension / cli のビルド |
| `pnpm check` | 型検査・lint・整形チェック・JSON Schema の検査・テストをまとめて実行 |
| `pnpm test:watch` | テストの監視実行 |
| `pnpm generate:schema` | DSL の JSON Schema を再生成（スキーマを変えたとき） |
| `pnpm catalog:extract` | Tk からウィジェットカタログを抽出（[catalog.md](catalog.md)） |
| `pnpm layout:record` | レイアウトの検証データを Tk で記録（[layout.md](layout.md)） |
| `pnpm codegen:verify-python` | 生成した Python のコードを実行して検証（tkinter の使える Python が必要。[codegen-design.md](codegen-design.md) §6） |
| `node packages/cli/dist/cli.js generate <file.tkui.json>` | CLI でコードを生成（`--force` で手編集された区間も上書き、`--check` で最新かだけを調べる） |

## 3. 拡張のデバッグ実行

VS Code 拡張機能の公式テンプレート（`yo code`）と同じ構成にしている。

1. VS Code で本リポジトリを開き、F5（**Run Extension**）を押す。
2. タスク `watch` が拡張（esbuild）と Webview（Vite）を監視モードでビルドし、初回のビルドが終わると
   開発用ウィンドウ（Extension Development Host）が `samples/` を開いた状態で起動する。
3. `samples/hello.tkui.json` を開くとデザイナーが表示される。

- ファイルを保存すると自動でビルドされる。
  - Webview の変更: デザイナーを開き直すと反映される。
  - 拡張の変更: デバッグツールバーの再起動（Ctrl+Shift+F5）で反映される。
- デバッグを停止すると開発用ウィンドウも閉じる。
- 開発用ウィンドウでは他の拡張機能を読み込まない（`--disable-extensions`）。
- 監視ビルドは型検査をしない。型の誤りは `pnpm check`（またはエディタ上の表示）で確認する。
- Webview の中身は、開発用ウィンドウで「開発者: Webview 開発者ツールを開く」から調べられる。

### Windows でデバッガが接続できない問題（js-debug の不具合）と対処

**症状**: F5 で開発用ウィンドウは開くが、デザイナーが読み込み中のまま止まり、しばらくしてデバッグ実行が終了する。成功したり失敗したりする。

**原因**（2026-09 時点、VS Code 1.139 / js-debug 1.117.0 で確認）:

1. デバッガ（js-debug）は拡張機能ホストに `http://localhost:<port>` で接続する。`localhost` の場合は `127.0.0.1` と `[::1]` の両方に並行してリクエストを送り、最初に成功したほうを採用する。
2. 拡張機能ホストのデバッグポートは `127.0.0.1` でしか待ち受けないため、`[::1]` へのリクエストは即座に拒否される。
3. 本来この拒否は「失敗」として扱われるべきだが、js-debug 内部の HTTP ライブラリの取り消し処理の不具合（`The onCancel handler was attached after the promise settled`）で例外になる。
   その例外で並行処理全体が失敗し、進行中だった `127.0.0.1` へのリクエストまで取り消される。これを時間切れまで繰り返す。
4. `127.0.0.1` の応答が `[::1]` の拒否より先に届いた場合だけ成功する。

**対処**: `[::1]` へのリクエストも成功するようにして、不具合の起きる経路を通らないようにする。

1. launch.json の Run Extension で、デバッグポートを `"port": 9339` に固定している（標準の構成が持つ設定項目）。
2. **この問題が起きる環境では、一度だけ次の設定を行う**（管理者権限の PowerShell）。Windows 標準のポート転送で、`[::1]:9339` への接続を `127.0.0.1:9339` に転送する。設定は再起動後も残る。

   ```powershell
   netsh interface portproxy add v6tov4 listenaddress=::1 listenport=9339 connectaddress=127.0.0.1 connectport=9339
   # 確認
   netsh interface portproxy show all
   # 不要になったら削除
   netsh interface portproxy delete v6tov4 listenaddress=::1 listenport=9339
   ```

   ポート転送には「IP Helper」サービス（iphlpsvc）が動いている必要がある（既定で自動起動）。

- ポートを固定しているため、開発用ウィンドウは同時に1つだけ開く。
- この問題の起きない環境では、ポート転送の設定は不要（`"port": 9339` があっても害はない）。
- js-debug が修正されれば、ポート転送の設定は不要になる。

**症状の確認方法**: `%APPDATA%\Code\logs\<日時>\window<N>\exthost\ms-vscode.js-debug\` の詳細ログ（launch.json に `"trace": true` を一時的に加えると出力される）に、
`connect ECONNREFUSED ::1:<port>` と `The onCancel handler was attached after the promise settled` が交互に出て、最後に
`Could not connect to debug target at http://localhost:<port>: Socket closed before the connection was established` となる。

**予備の構成**: どうしても接続できない場合は **Attach to Extension Host (127.0.0.1)** を使う。タスク `launch-dev-host` がデバッグポートを 9339 に固定して開発用ウィンドウを起動し、Node の attach 構成で `127.0.0.1:9339` に直接接続する（不具合の経路を通らない）。
デバッグを停止しても開発用ウィンドウは閉じないので手で閉じる、拡張の変更は開発用ウィンドウで「開発者: ウィンドウの再読み込み」を実行して反映する、という点が標準の構成と異なる。

## 4. 改行コード

Windows の git 設定（`core.autocrlf=true`）により、コミット時に LF → CRLF の警告が出るが実害はない。
