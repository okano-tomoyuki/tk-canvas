# 編集基盤

デザイナー上の操作を DSL ファイルに反映する仕組み。方針は [ADR 0006](adr/0006-document-state-and-undo.md)。

## 1. 構成

| 場所 | 役割 |
|---|---|
| [core/src/edit/commands.ts](../packages/core/src/edit/commands.ts) | 編集コマンドと `applyCommand(doc, command)`（純粋関数、Immer による不変更新） |
| [core/src/edit/defaults.ts](../packages/core/src/edit/defaults.ts) | 追加・移動時の初期値（id の採番、初期オプション・layout・placement） |
| [core/src/edit/textEdit.ts](../packages/core/src/edit/textEdit.ts) | 変更前後のテキストから最小の置き換え範囲を求める |
| [core/src/protocol.ts](../packages/core/src/protocol.ts) | 拡張と Webview の間のメッセージ |
| [extension/src/applyEditCommand.ts](../packages/extension/src/applyEditCommand.ts) | コマンドを TextDocument に適用し、WorkspaceEdit で反映 |
| [webview/src/store/](../packages/webview/src/store/) | ドキュメントストア（確定内容・楽観的な反映・応答待ち）、UI ストア（選択） |
| [webview/src/editing.ts](../packages/webview/src/editing.ts) | UI から呼ぶ操作（選択状態を踏まえてコマンドを組み立てる） |

## 2. 編集コマンド

| コマンド | 内容 | 補足 |
|---|---|---|
| `addWidget` | ウィジェットを追加 | id は呼び出し側で決める（`nextWidgetId`）。親の置き方に応じた placement、表示文字列、コンテナには grid の layout を初期値として与える |
| `removeWidget` | ウィジェットを削除 | ルートは削除できない |
| `moveWidget` | 親・位置を変更 | 子孫の中へは移動できない。親の置き方が変わると placement を付け直す |
| `renameWidget` | id を変更 | 識別子の規則・重複を検査する |
| `setOption` | オプションを設定・削除 | `value: undefined` で削除 |
| `setPlacement` | placement を設定・削除 | |
| `setLayout` | layout を設定・削除 | manager が変わると子の placement を初期値に置き換える（grid なら上から順に行を割り当てる） |
| `setWindow` | ルートの window（wm 系の設定）を設定 | 値が undefined の項目は削除し、すべて空なら window ごと削除する |

コマンドは失敗すると理由を返す（`{ ok: false, error }`）。適用結果は常に検証（dsl-spec.md §11）を通る状態を保つことを、テストで確認している。

## 3. 流れ

1. Webview で操作すると、`applyCommand` をローカルで適用して即座に表示し（楽観的な反映）、`edit`（requestId とコマンド）を拡張に送る。
   ローカルで適用できないコマンドは送らない。
2. 拡張は編集を届いた順に1つずつ処理する。TextDocument の現在の内容に同じコマンドを適用し、正規形で書き出し、変更前との差分の範囲だけを WorkspaceEdit で置き換える。
   改行コードは文書に合わせる。
3. TextDocument が変わると `document`（版番号と全文）を Webview に送る。続いて `editResult` を送る。
4. Webview は応答待ちの編集が残っている間は楽観的な表示を保ち、すべての応答が返った時点で拡張から受け取った最新の内容に揃える。拒否された編集は理由を表示する。

Undo/Redo は VS Code のテキスト Undo がそのまま使われ、結果は 3. の経路で Webview に届く。

## 4. プロパティエディタ

インスペクタ（[webview/src/components/inspector/](../packages/webview/src/components/inspector/)）で、選択中のウィジェットを編集する。

| 欄 | 内容 |
|---|---|
| id / class | id の変更（`renameWidget`） |
| ウィンドウ | ルートのみ。title、geometry、resizable、minsize / maxsize（`setWindow`） |
| 配置 | 親の置き方（pack / grid / place / Notebook のタブ / PanedWindow のペイン）に応じた placement の項目（`setPlacement`） |
| レイアウト | layout で子を並べるコンテナのみ。manager、propagate、grid の行・列ごとの weight / minsize / pad / uniform（`setLayout`） |
| オプション | カタログの「よく使うオプション」と設定済みのオプション。「すべてのオプションを表示」で残りも表示する（`setOption`） |

入力の決まり:

- 文字入力は Enter またはフォーカスを外したときに確定する（1回の確定 = Undo 1回）。Esc で入力前に戻す。選択肢・チェックは変更した時点で確定する。
- 空欄は「値を書かない（Tk の既定値）」を表す。欄には Tk の既定値を薄く表示する（オプションはカタログの既定値）。
- 入力欄の型はカタログの型に従う（列挙値・真偽は選択肢、変数参照は型の合う変数の一覧、command はメソッド名、その他は文字入力）。
  文字入力の変換規則は [core/src/edit/inputs.ts](../packages/core/src/edit/inputs.ts)。
- 形式が不正な入力は確定せず、その欄にエラーを表示する。確定後の検証エラー（dsl-spec.md §11）も、下部の一覧に加えて該当する欄に表示する。
- オプション名の後ろの `*` は、生成時にしか指定できないオプション。
- 外部（Undo、テキストエディタでの編集）で値が変わると、入力中の内容を捨てて新しい値を表示する。

## 5. 今後の課題

- ドラッグなどの連続操作は、確定時に1コマンドだけ送る（途中経過は UI ストアで表示する）。
- 変数・bindings を編集するコマンドと UI（段階 B）。
- 1回の操作で複数のコマンドが必要になる場合に備え、複数コマンドを1回の WorkspaceEdit にまとめる仕組みを検討する。
