/**
 * 変数・ハンドラの一覧（UI での一覧表示・候補表示に使う）。
 */
import { findOption, getWidgetCatalog } from '../catalog/catalog.ts';
import type { TkuiDocument } from '../dsl/schema.ts';
import type { HandlerSignature } from '../dsl/signature.ts';
import { walkNodes } from './tree.ts';

export interface HandlerUsage {
  readonly name: string;
  /** 参照している箇所の数（command と bindings の合計） */
  readonly count: number;
  /** 参照元から決まるシグネチャ。2種類以上あれば検証エラー（handler-signature-conflict） */
  readonly signatures: readonly HandlerSignature[];
}

/** ドキュメント中のハンドラを、最初に参照された順に列挙する */
export function collectHandlers(doc: TkuiDocument): HandlerUsage[] {
  const usages = new Map<string, { count: number; signatures: Set<HandlerSignature> }>();
  const add = (name: string, signature: HandlerSignature | undefined) => {
    const usage = usages.get(name) ?? { count: 0, signatures: new Set<HandlerSignature>() };
    usage.count++;
    if (signature) usage.signatures.add(signature);
    usages.set(name, usage);
  };

  for (const node of walkNodes(doc)) {
    const widgetClass = getWidgetCatalog().classes.get(node.class);
    for (const [key, value] of Object.entries(node.options ?? {})) {
      if (typeof value !== 'object' || !('handler' in value)) continue;
      const type = widgetClass && findOption(widgetClass, key)?.option.type;
      add(value.handler, type?.kind === 'callback' ? type.signature : undefined);
    }
    for (const binding of node.bindings ?? []) add(binding.handler, 'event');
  }
  return [...usages].map(([name, u]) => ({ name, count: u.count, signatures: [...u.signatures] }));
}

/** 変数ごとの参照数 */
export function countVariableReferences(doc: TkuiDocument): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const node of walkNodes(doc)) {
    for (const value of Object.values(node.options ?? {})) {
      if (typeof value === 'object' && 'var' in value)
        counts.set(value.var, (counts.get(value.var) ?? 0) + 1);
    }
  }
  return counts;
}

/** bind シーケンスからハンドラ名の一部を作る（例: "<Return>" → "return"、"<<ComboboxSelected>>" → "comboboxselected"） */
export function sequenceToName(sequence: string): string {
  const name = sequence
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
  return name === '' ? 'event' : name;
}
