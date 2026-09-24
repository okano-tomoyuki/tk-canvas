/**
 * コード生成の中間表現（docs/codegen-design.md §1）。
 * DSL を、言語に依存しない「宣言・生成・配置・イベント」の情報に整理する。各言語のエミッタはこれを文字列にする。
 */
import {
  containerKindOf,
  findOption,
  getWidgetCatalog,
  walkNodes,
  type AnyNode,
  type ContainerKind,
  type HandlerSignature,
  type Layout,
  type LiteralValue,
  type TkuiDocument,
  type Variable,
  type WindowSettings,
} from '@tk-designer/core';

export type GenValue =
  | { readonly kind: 'literal'; readonly value: LiteralValue }
  | { readonly kind: 'var'; readonly name: string };

export interface GenOption {
  readonly name: string;
  readonly value: GenValue;
  /** 生成時にしか指定できない */
  readonly creationOnly: boolean;
}

export interface GenWidget {
  readonly id: string;
  /** DSL のクラス名（例: "ttk.Button"） */
  readonly className: string;
  /** ルートの場合は undefined */
  readonly parentId: string | undefined;
  /** 親の子の置き方（ルートの場合は undefined） */
  readonly parentKind: ContainerKind | undefined;
  /** 参照以外のオプションと変数参照（ハンドラ参照は events へ） */
  readonly options: readonly GenOption[];
  readonly placement: Readonly<Record<string, LiteralValue>>;
  readonly layout: Layout | undefined;
}

export interface GenEvent {
  readonly widgetId: string;
  /** command などのオプション名、または bind のシーケンス */
  readonly kind: 'option' | 'bind';
  readonly name: string;
  readonly handler: string;
}

export interface GenHandler {
  readonly name: string;
  readonly signature: HandlerSignature;
}

export interface GenModel {
  readonly className: string;
  readonly root: GenWidget & { readonly className: 'tk.Tk' | 'tk.Toplevel' };
  readonly window: WindowSettings;
  readonly variables: readonly (readonly [string, Variable])[];
  /** ルート以外のウィジェット（親から順） */
  readonly widgets: readonly GenWidget[];
  readonly events: readonly GenEvent[];
  /** 最初に参照された順 */
  readonly handlers: readonly GenHandler[];
}

/** 検証を通過したドキュメントから中間表現を作る */
export function buildModel(doc: TkuiDocument, className: string): GenModel {
  const parents = new Map<AnyNode, AnyNode>();
  for (const node of walkNodes(doc))
    for (const child of node.children ?? []) parents.set(child, node);

  const events: GenEvent[] = [];
  const handlers = new Map<string, HandlerSignature>();
  const addHandler = (name: string, signature: HandlerSignature) => {
    if (!handlers.has(name)) handlers.set(name, signature);
  };

  const toWidget = (node: AnyNode): GenWidget => {
    const parent = parents.get(node);
    const widgetClass = getWidgetCatalog().classes.get(node.class);
    const options: GenOption[] = [];
    for (const [name, value] of Object.entries(node.options ?? {})) {
      const option = widgetClass && findOption(widgetClass, name)?.option;
      if (typeof value === 'object' && 'handler' in value) {
        events.push({ widgetId: node.id, kind: 'option', name, handler: value.handler });
        addHandler(
          value.handler,
          option?.type.kind === 'callback' ? (option.type.signature ?? 'none') : 'none',
        );
        continue;
      }
      const genValue: GenValue =
        typeof value === 'object' && 'var' in value
          ? { kind: 'var', name: value.var }
          : { kind: 'literal', value };
      options.push({ name, value: genValue, creationOnly: option?.creationOnly ?? false });
    }
    for (const binding of node.bindings ?? []) {
      events.push({
        widgetId: node.id,
        kind: 'bind',
        name: binding.sequence,
        handler: binding.handler,
      });
      addHandler(binding.handler, 'event');
    }
    return {
      id: node.id,
      className: node.class,
      parentId: parent?.id,
      parentKind: parent && containerKindOf(parent),
      options,
      placement: ('placement' in node ? node.placement : undefined) ?? {},
      layout: node.layout,
    };
  };

  const [rootNode, ...others] = [...walkNodes(doc)];
  const root = toWidget(rootNode ?? doc.root) as GenModel['root'];
  const widgets = others.map(toWidget);
  return {
    className,
    root,
    window: doc.root.window ?? {},
    variables: Object.entries(doc.variables ?? {}),
    widgets,
    events,
    handlers: [...handlers].map(([name, signature]) => ({ name, signature })),
  };
}
