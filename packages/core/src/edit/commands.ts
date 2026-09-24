/**
 * ドキュメントの編集コマンド（docs/adr/0006）。
 * コマンドは純粋関数 applyCommand(doc, command) で適用する。Webview（楽観的な反映）と拡張（実際の反映）の両方で同じ関数を使う。
 * コマンドは「どのウィジェットをどう変えるか」という意図で表し、テキスト上の位置には依存しない。
 */
import { produce } from 'immer';
import { getWidgetCatalog } from '../catalog/catalog.ts';
import { isValidIdentifier } from '../identifier.ts';
import { containerKindOf } from '../dsl/placement.ts';
import type { Layout, OptionValue, Placement, TkuiDocument, WidgetNode } from '../dsl/schema.ts';
import { defaultLayout, defaultOptions, defaultPlacement } from './defaults.ts';
import { collectMemberNames, findNode, isDescendantOrSelf, type AnyNode } from './tree.ts';

export type EditCommand =
  /** id は呼び出し側で nextWidgetId() などにより決める（楽観的な反映と実際の反映で同じ id にするため） */
  | {
      readonly type: 'addWidget';
      readonly parentId: string;
      readonly id: string;
      readonly className: string;
      /** 省略時は末尾 */
      readonly index?: number;
    }
  | { readonly type: 'removeWidget'; readonly id: string }
  /** index は移動先の children 内での位置（移動元から取り除いた後の位置） */
  | {
      readonly type: 'moveWidget';
      readonly id: string;
      readonly parentId: string;
      readonly index: number;
    }
  | { readonly type: 'renameWidget'; readonly id: string; readonly newId: string }
  /** value が undefined ならオプションを削除する */
  | {
      readonly type: 'setOption';
      readonly id: string;
      readonly name: string;
      readonly value: OptionValue | undefined;
    }
  | {
      readonly type: 'setPlacement';
      readonly id: string;
      readonly placement: Placement | undefined;
    }
  /** manager が変わると、子の placement は新しい manager の初期値に置き換える */
  | { readonly type: 'setLayout'; readonly id: string; readonly layout: Layout | undefined };

export type CommandResult =
  | { readonly ok: true; readonly document: TkuiDocument }
  | { readonly ok: false; readonly error: string };

class CommandError extends Error {}

/**
 * Immer の produce を「下書きも同じ型」として呼び出すための型付け。
 * DSL の型は（リテラル配列を除き）もともと可変なので、下書きをそのまま DSL の型として扱える。
 * 標準の Draft<T> 型は、再帰的なリテラル値の型で展開が深くなりすぎる（TS2589）ため使わない。
 */
const produceDocument = produce as (
  base: TkuiDocument,
  recipe: (draft: TkuiDocument) => void,
) => TkuiDocument;

export function applyCommand(doc: TkuiDocument, command: EditCommand): CommandResult {
  try {
    const document = produceDocument(doc, (draft) => {
      apply(draft, command);
    });
    return { ok: true, document };
  } catch (e) {
    if (e instanceof CommandError) return { ok: false, error: e.message };
    throw e;
  }
}

function apply(doc: TkuiDocument, command: EditCommand): void {
  switch (command.type) {
    case 'addWidget': {
      const parent = requireNode(doc, command.parentId);
      const info = getWidgetCatalog().classes.get(command.className);
      if (!info) throw new CommandError(`${command.className} はカタログにないクラスです`);
      if (info.name === 'tk.Tk' || info.name === 'tk.Toplevel') {
        throw new CommandError(`${info.name} は追加できません`);
      }
      requireContainer(parent);
      requireNewName(doc, command.id);

      const siblings = parent.children ?? [];
      const widget: WidgetNode = {
        id: command.id,
        class: command.className,
        options: defaultOptions(command.className, command.id),
        layout: defaultLayout(command.className),
        placement: defaultPlacement(containerKindOf(parent), siblings, command.id),
      };
      insertChild(parent, removeUndefined(widget), command.index ?? siblings.length);
      return;
    }

    case 'removeWidget': {
      const { parent, index } = requireChild(doc, command.id);
      parent.children?.splice(index, 1);
      normalizeChildren(parent);
      return;
    }

    case 'moveWidget': {
      const { node, parent: oldParent, index } = requireChild(doc, command.id);
      const newParent = requireNode(doc, command.parentId);
      if (isDescendantOrSelf(node, newParent)) {
        throw new CommandError('ウィジェットを自分自身またはその子孫の中へは移動できません');
      }
      requireContainer(newParent);

      const oldKind = containerKindOf(oldParent);
      oldParent.children?.splice(index, 1);
      normalizeChildren(oldParent);

      const newKind = containerKindOf(newParent);
      if (newKind !== oldKind) {
        setOrDelete(
          node,
          'placement',
          defaultPlacement(newKind, newParent.children ?? [], node.id),
        );
      }
      insertChild(newParent, node, command.index);
      return;
    }

    case 'renameWidget': {
      const { node } = requireNodeLocation(doc, command.id);
      if (command.newId === node.id) return;
      requireNewName(doc, command.newId);
      node.id = command.newId;
      return;
    }

    case 'setOption': {
      const { node } = requireNodeLocation(doc, command.id);
      if (command.value === undefined) {
        if (node.options) {
          // 利用者が決めた名前をキーとするため、動的な削除になる
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
          delete node.options[command.name];
          if (Object.keys(node.options).length === 0) delete node.options;
        }
      } else {
        node.options ??= {};
        node.options[command.name] = command.value;
      }
      return;
    }

    case 'setPlacement': {
      const { node, parent } = requireNodeLocation(doc, command.id);
      if (!parent) throw new CommandError('ルートには placement を設定できません');
      setOrDelete(node as WidgetNode, 'placement', command.placement);
      return;
    }

    case 'setLayout': {
      const { node } = requireNodeLocation(doc, command.id);
      const before = containerKindOf(node);
      setOrDelete(node, 'layout', command.layout);
      const after = containerKindOf(node);
      if (after !== before) {
        // 子の placement を新しい manager の初期値に置き換える（grid なら上から順に行を割り当てる）
        const placed: WidgetNode[] = [];
        for (const child of node.children ?? []) {
          setOrDelete(child, 'placement', defaultPlacement(after, placed, child.id));
          placed.push(child);
        }
      }
      return;
    }
  }
}

// ---- 補助 -------------------------------------------------------------------

function requireNodeLocation(doc: TkuiDocument, id: string) {
  const location = findNode(doc, id);
  if (!location) throw new CommandError(`ウィジェット "${id}" が見つかりません`);
  return location;
}

function requireNode(doc: TkuiDocument, id: string): AnyNode {
  return requireNodeLocation(doc, id).node;
}

function requireChild(doc: TkuiDocument, id: string) {
  const { node, parent, index } = requireNodeLocation(doc, id);
  if (!parent) throw new CommandError('ルートは移動・削除できません');
  return { node: node as WidgetNode, parent, index };
}

function requireContainer(node: AnyNode): void {
  if (!getWidgetCatalog().classes.get(node.class)?.children) {
    throw new CommandError(`${node.class} は子を持てません`);
  }
}

function requireNewName(doc: TkuiDocument, name: string): void {
  const problem = isValidIdentifier(name);
  if (problem) throw new CommandError(`"${name}" は名前として使えません（${problem}）`);
  if (collectMemberNames(doc).has(name)) {
    throw new CommandError(`"${name}" は既に使われています`);
  }
}

function insertChild(parent: AnyNode, child: WidgetNode, index: number): void {
  parent.children ??= [];
  const clamped = Math.max(0, Math.min(index, parent.children.length));
  parent.children.splice(clamped, 0, child);
}

/** 空になった children を取り除き、正規形を保つ */
function normalizeChildren(node: AnyNode): void {
  if (node.children?.length === 0) delete node.children;
}

function setOrDelete<N extends object, K extends keyof N>(
  node: N,
  key: K,
  value: N[K] | undefined,
): void {
  if (value === undefined) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete node[key];
  } else {
    node[key] = value;
  }
}

function removeUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}
