import type { RootNode, TkuiDocument, WidgetNode } from '../dsl/schema.ts';

export type AnyNode = RootNode | WidgetNode;

export interface NodeLocation<N extends AnyNode = AnyNode> {
  readonly node: N;
  /** ルートの場合は undefined */
  readonly parent: AnyNode | undefined;
  /** 親の children 内での位置（ルートは -1） */
  readonly index: number;
}

/** id でノードを探す（深さ優先。id が重複している場合は最初に見つかったもの） */
export function findNode(doc: TkuiDocument, id: string): NodeLocation | undefined {
  if (doc.root.id === id) return { node: doc.root, parent: undefined, index: -1 };
  return findIn(doc.root, id);
}

function findIn(parent: AnyNode, id: string): NodeLocation | undefined {
  const children = parent.children ?? [];
  for (const [index, child] of children.entries()) {
    if (child.id === id) return { node: child, parent, index };
    const found = findIn(child, id);
    if (found) return found;
  }
  return undefined;
}

/** ルートから id のノードまでの経路（両端を含む）。見つからなければ undefined */
export function pathTo(doc: TkuiDocument, id: string): AnyNode[] | undefined {
  const walk = (node: AnyNode, path: AnyNode[]): AnyNode[] | undefined => {
    const here = [...path, node];
    if (node.id === id) return here;
    for (const child of node.children ?? []) {
      const found = walk(child, here);
      if (found) return found;
    }
    return undefined;
  };
  return walk(doc.root, []);
}

/** node が ancestor 自身またはその子孫か */
export function isDescendantOrSelf(ancestor: AnyNode, node: AnyNode): boolean {
  if (ancestor === node) return true;
  return (ancestor.children ?? []).some((child) => isDescendantOrSelf(child, node));
}

/** ノードを深さ優先で列挙する（ルートを含む） */
export function* walkNodes(doc: TkuiDocument): Generator<AnyNode> {
  yield* walk(doc.root);
}

function* walk(node: AnyNode): Generator<AnyNode> {
  yield node;
  for (const child of node.children ?? []) yield* walk(child);
}

/**
 * 生成コードのメンバ名として使われている名前（ウィジェット id・変数名・ハンドラ名）をすべて集める。
 */
export function collectMemberNames(doc: TkuiDocument): Set<string> {
  const names = new Set<string>(Object.keys(doc.variables ?? {}));
  for (const node of walkNodes(doc)) {
    names.add(node.id);
    for (const value of Object.values(node.options ?? {})) {
      if (typeof value === 'object' && 'handler' in value) names.add(value.handler);
    }
    for (const binding of node.bindings ?? []) names.add(binding.handler);
  }
  return names;
}
