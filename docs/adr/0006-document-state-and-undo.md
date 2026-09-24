# 0006. 状態管理と Undo/Redo: テキスト文書を唯一の正とし、Undo は VS Code に委ねる

- 状態: 承認
- 日付: 2026-09-24

## 背景

デザイナーには「DSL の内容（ドキュメント）」と「選択中のウィジェット、ドラッグ中の位置、ズームなど UI の一時状態」の2種類の状態がある。
旧実装はこれらが Canvas・ツリー・プロパティパネルに分散し、同期が複雑化していた。
また Undo/Redo・保存・未保存表示を VS Code と整合させる必要がある。

## 検討した選択肢

### 編集モデル

- **CustomTextEditorProvider**: DSL ファイルの TextDocument が唯一の正。Webview の操作はテキスト編集（WorkspaceEdit）として適用する。
  Undo/Redo・保存・未保存表示・ホットイグジット・git diff を VS Code がそのまま処理する。同じファイルをテキストエディタで同時に開いても整合する。
- **CustomEditorProvider（非テキスト）**: 独自のドキュメントモデルと Undo スタックを持つ。自由度は高いが、Undo・保存・バックアップをすべて自前で実装する必要がある。

### Webview の状態管理

- **useReducer + Context**: 追加ライブラリ不要。ただし Context 更新で広い範囲が再描画されやすく、
  キャンバス・ツリー・プロパティパネルのように1つの状態を多くのコンポーネントが部分的に参照する UI には向かない。
- **Zustand (+ Immer)**: セレクタで必要な部分だけを購読でき、再描画を抑えられる。React 外（メッセージ受信ハンドラ等）からも状態を読み書きできる。
  API が小さく、学習コストが低い。

## 決定

1. **CustomTextEditorProvider を採用し、DSL の TextDocument を唯一の正とする。**
2. **ドキュメントへの変更は core の「コマンド」（純粋関数 `(doc, command) => doc`）で表す。** Immer で不変更新を書く。
   コマンドは core にあるため、React や VS Code に依存せず単体テストできる。
3. **Undo/Redo は VS Code のテキスト Undo に委ねる**（自前の Undo スタックは持たない）。
   1回の操作 = 1回のテキスト編集になるように、ドラッグなどの連続操作は Webview 内の一時状態で表示し、確定時に1コマンドだけ送る。
4. **Webview の状態管理は Zustand** を使う。ストアは次の2つに分ける。
   - ドキュメントストア: 拡張から受け取ったドキュメントの写し（読み取り専用。変更はコマンド送信でのみ行う）
   - UI ストア: 選択・ホバー・ドラッグ中の状態・ズームなど、Webview 内で閉じる状態

### データの流れ

```
[Webview] 操作 → コマンド生成 → (楽観的にローカル反映) → postMessage(edit: requestId, command)
[拡張]   コマンドを TextDocument の現在の内容に適用 (core) → 正規形でシリアライズ → 最小範囲の WorkspaceEdit
[拡張]   onDidChangeTextDocument → postMessage(document: version, text) → [Webview] 確定内容を更新
[拡張]   postMessage(editResult: requestId, ok) → [Webview] 応答待ちがなくなれば確定内容に揃える
```

- テキストエディタでの直接編集・Undo/Redo も同じ `onDidChangeTextDocument` 経由で Webview に届くため、経路が1本になる。
- コマンドは「どのウィジェットをどう変えるか」という意図で表すため、拡張は Webview が見ていた版ではなく**現在の内容**に適用する。
  版番号による競合検出（当初案）は行わない。
- Webview は応答待ちの編集がある間は楽観的に反映した表示を保ち、すべての応答が返った時点で拡張側の確定内容に揃える。
  拡張が拒否した編集は、この時点で表示から消える。

（2026-09-24 追記: 実装時に、版番号による競合検出から requestId による応答待ち管理に変更した。詳細は [editing.md](../editing.md)。）

## 影響

- シリアライズは**決定的**（キー順・インデントを固定）にし、1操作による差分を最小にする。git diff も読みやすくなる。
- JSON がパースできない状態（テキストエディタで編集途中など）では、Webview はエラー表示にして編集を受け付けない。
- 1操作が複数の変更を伴う場合（ウィジェットの削除とそれを参照するハンドラの整理など）も、1つのコマンド = 1回の WorkspaceEdit にまとめる。
