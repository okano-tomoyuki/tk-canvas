/**
 * ハンドラのシグネチャ（docs/dsl-spec.md §9）。
 * - none: 引数なし（Button の command など）
 * - value: 現在値を1つ受け取る（Scale の command）
 * - event: イベントを1つ受け取る（bind）
 */
export type HandlerSignature = 'none' | 'value' | 'event';
