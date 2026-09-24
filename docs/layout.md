# レイアウトエンジン

デザイナーのキャンバスに表示するため、DSL の pack / grid / place などに従って各ウィジェットの位置と大きさを計算する。
方針は [ADR 0008](adr/0008-layout-engine-in-core.md)。

## 1. 構成

| ファイル | 内容 |
|---|---|
| [layout/engine.ts](../packages/core/src/layout/engine.ts) | `computeLayout(doc, metrics, options)`。ツリー全体の要求サイズを下から、配置を上から計算する |
| [layout/pack.ts](../packages/core/src/layout/pack.ts) | pack（Tk 8.6 `tkPack.c` の ArrangePacking / XExpansion / YExpansion の移植） |
| [layout/grid.ts](../packages/core/src/layout/grid.ts) | grid（`tkGrid.c` の ResolveConstraints / AdjustOffsets / AdjustForSticky の移植） |
| [layout/place.ts](../packages/core/src/layout/place.ts) | place（`tkPlace.c` の RecomputePlacement の移植） |
| [layout/types.ts](../packages/core/src/layout/types.ts) | `LayoutMetrics`（呼び出し側が実装する寸法の提供）と結果の型 |

C の int 除算（0 方向への切り捨て）や四捨五入の仕方まで Tk に合わせている。

## 2. 使い方

```ts
const layout = computeLayout(doc, {
  naturalSize: (node) => ({ width, height }), // 子の配置から大きさが決まらないウィジェットの要求サイズ
  insets: (node) => ({ left, top, right, bottom }), // コンテナの内側の余白（枠線・padding、Notebook のタブ領域）
});
layout.get('ok_button'); // { rect: {x, y, width, height}, requested: {width, height}, mapped }
```

- 位置はルートウィンドウの内側の左上を原点とする。
- ルートの大きさは `window.geometry` の値、なければ要求サイズ。
- `mapped` が false のもの（大きさが 0 以下になった、Notebook の選択されていないタブの中身）は Tk では表示されない。
- Notebook で表示するタブは `options.selectedTabs` で指定する（既定は最初のタブ）。

## 3. 検証

アルゴリズムと要求サイズの推定を分けて検証する（ADR 0008）。

1. `pnpm layout:record` で、`packages/core/src/layout/fixtures/*.tkui.json` を実際の Tk で表示し、
   各ウィジェットの要求サイズと配置を `*.tk.json` に記録する（Tk 入りの tclsh が必要。記録結果はコミットする）。
2. `engine.tk.test.ts` で、葉ウィジェットの要求サイズに記録値を与えてエンジンを実行し、全ウィジェットの要求サイズ・位置・大きさ・表示の有無が Tk と一致することを確認する。

現在のフィクスチャ（5 件、39 ウィジェット）はすべて一致している。

| フィクスチャ | 内容 |
|---|---|
| pack-basic | side の混在、fill、padx の非対称、ipadx / ipady、anchor |
| pack-expand | expand の配分（左右・上下の混在） |
| grid-weights | weight、minsize、pad、columnspan / rowspan、sticky、行の自動割り当て |
| grid-shrink | 要求サイズより小さいウィンドウでの縮小、uniform |
| nested | pack の中の grid・place、tk.Frame の枠線と padx / pady |

## 4. 制約・今後の課題

- **要求サイズの推定は未実装**。文字幅の計測などで葉ウィジェットの要求サイズを推定する `LayoutMetrics` の実装は、Webview 側で次に作る。
- Notebook と PanedWindow は近似。タブ領域の高さ・仕切りの太さはテーマに依存するため、Tk との比較テストはしていない。
  PanedWindow で weight がすべて 0 のときは、余りを最後のペインで吸収する。
- grid の `anchor`（既定 nw 以外）、`Tk_SetMinimumRequestSize` による最小要求サイズは扱っていない。
- Windows ではタイトルバーのため、ルートウィンドウに最小幅がある。geometry を指定しない場合、実際の幅が要求サイズより大きくなることがある。
