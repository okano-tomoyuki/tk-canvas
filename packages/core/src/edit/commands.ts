/**
 * ドキュメントの編集コマンド（docs/adr/0006）。
 * コマンドは純粋関数 applyCommand(doc, command) で適用する。Webview（楽観的な反映）と拡張（実際の反映）の両方で同じ関数を使う。
 * コマンドは「どのウィジェットをどう変えるか」という意図で表し、テキスト上の位置には依存しない。
 */
import { produce } from 'immer';
import { getWidgetCatalog } from '../catalog/catalog.ts';
import { memberNameProblem } from '../identifier.ts';
import { containerKindOf } from '../dsl/placement.ts';
import { isWindowClass } from '../dsl/schema.ts';
import type {
  Binding,
  CodegenSettings,
  Layout,
  OptionValue,
  Placement,
  TkuiDocument,
  Variable,
  WidgetNode,
  WindowSettings,
} from '../dsl/schema.ts';
import { defaultLayout, defaultOptions, defaultPlacement } from './defaults.ts';
import {
  collectMemberNames,
  findNode,
  isDescendantOrSelf,
  walkNodes,
  type AnyNode,
} from './tree.ts';

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
  | { readonly type: 'setLayout'; readonly id: string; readonly layout: Layout | undefined }
  /** ルートウィンドウの wm 系の設定。undefined の項目は削除する（すべて空なら window ごと削除） */
  | { readonly type: 'setWindow'; readonly window: WindowSettings }
  /** 変数の追加・変更（名前が新しければ追加） */
  | { readonly type: 'setVariable'; readonly name: string; readonly variable: Variable }
  /** 変数の削除。その変数を参照しているオプションも削除する（参照切れを残さない） */
  | { readonly type: 'removeVariable'; readonly name: string }
  /** 変数の改名。参照もすべて新しい名前に置き換える */
  | { readonly type: 'renameVariable'; readonly name: string; readonly newName: string }
  /** ウィジェットの bindings を置き換える（空なら削除） */
  | { readonly type: 'setBindings'; readonly id: string; readonly bindings: readonly Binding[] }
  /** ハンドラの改名。command と bindings の参照をすべて置き換える */
  | { readonly type: 'renameHandler'; readonly name: string; readonly newName: string }
  /** コード生成の設定（docs/adr/0010）。空なら codegen ごと削除する */
  | { readonly type: 'setCodegen'; readonly codegen: CodegenSettings }
  /** 複数のコマンドを1つの変更としてまとめて適用する（途中で失敗したら何も変えない。Undo も1回） */
  | { readonly type: 'batch'; readonly commands: readonly EditCommand[] };

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
      if (isWindowClass(info.name)) {
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
        deleteKey(node, 'options', command.name);
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

    case 'setWindow': {
      const window = removeUndefined({ ...command.window });
      if (Object.keys(window).length > 0 && !isWindowClass(doc.root.class)) {
        throw new CommandError(
          `${doc.root.class} はウィンドウではないため、window は指定できません`,
        );
      }
      setOrDelete(doc.root, 'window', Object.keys(window).length > 0 ? window : undefined);
      return;
    }

    case 'setVariable': {
      const exists = doc.variables?.[command.name] !== undefined;
      if (!exists) requireNewName(doc, command.name);
      doc.variables ??= {};
      doc.variables[command.name] = removeUndefined({ ...command.variable });
      return;
    }

    case 'removeVariable': {
      requireVariable(doc, command.name);
      deleteKey(doc, 'variables', command.name);
      forEachReference(
        doc,
        (value) => 'var' in value && value.var === command.name,
        (node, key) => {
          deleteKey(node, 'options', key);
        },
      );
      return;
    }

    case 'renameVariable': {
      const variable = requireVariable(doc, command.name);
      if (command.newName === command.name) return;
      requireNewName(doc, command.newName);
      // 並び順は正規形で整えられるため、削除して追加すればよい
      deleteKey(doc, 'variables', command.name);
      doc.variables ??= {};
      doc.variables[command.newName] = variable;
      forEachReference(
        doc,
        (value) => 'var' in value && value.var === command.name,
        (node, key) => {
          (node.options ?? {})[key] = { var: command.newName };
        },
      );
      return;
    }

    case 'setBindings': {
      const { node } = requireNodeLocation(doc, command.id);
      setOrDelete(
        node,
        'bindings',
        command.bindings.length > 0 ? command.bindings.map((b) => ({ ...b })) : undefined,
      );
      return;
    }

    case 'renameHandler': {
      if (command.newName === command.name) return;
      const problem = memberNameProblem(command.newName);
      if (problem)
        throw new CommandError(`"${command.newName}" は名前として使えません: ${problem}`);
      // 既存のハンドラ名への改名は「統合」として許す。ウィジェット・変数の名前とは重複できない
      const others = collectMemberNames(doc);
      const isHandler = [...walkNodes(doc)].some(
        (n) =>
          (n.bindings ?? []).some((b) => b.handler === command.newName) ||
          Object.values(n.options ?? {}).some(
            (v) => typeof v === 'object' && 'handler' in v && v.handler === command.newName,
          ),
      );
      if (others.has(command.newName) && !isHandler) {
        throw new CommandError(`"${command.newName}" は既に使われています`);
      }
      for (const node of walkNodes(doc)) {
        for (const binding of node.bindings ?? []) {
          if (binding.handler === command.name) binding.handler = command.newName;
        }
      }
      forEachReference(
        doc,
        (value) => 'handler' in value && value.handler === command.name,
        (node, key) => {
          (node.options ?? {})[key] = { handler: command.newName };
        },
      );
      return;
    }

    case 'setCodegen': {
      const codegen = removeUndefined({ ...command.codegen });
      setOrDelete(doc, 'codegen', Object.keys(codegen).length > 0 ? codegen : undefined);
      return;
    }

    case 'batch': {
      // produce の中で順に適用する。途中で例外になれば produce ごと破棄される
      for (const inner of command.commands) apply(doc, inner);
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

function requireVariable(doc: TkuiDocument, name: string): Variable {
  const variable = doc.variables?.[name];
  if (!variable) throw new CommandError(`変数 "${name}" が見つかりません`);
  return variable;
}

/** 参照（{ var } / { handler }）を値に持つオプションを列挙する */
function forEachReference(
  doc: TkuiDocument,
  match: (value: { var: string } | { handler: string }) => boolean,
  visit: (node: AnyNode, key: string) => void,
): void {
  for (const node of walkNodes(doc)) {
    for (const [key, value] of Object.entries(node.options ?? {})) {
      if (isReference(value) && match(value)) visit(node, key);
    }
  }
}

function isReference(value: OptionValue): value is { var: string } | { handler: string } {
  return typeof value === 'object' && ('var' in value || 'handler' in value);
}

/** 名前をキーとするオブジェクト（variables / options）から1項目を削除し、空になればオブジェクトごと削除する */
function deleteKey<N extends object>(owner: N, field: keyof N, key: string): void {
  const record = owner[field] as Record<string, unknown> | undefined;
  if (!record) return;
  // 利用者が決めた名前をキーとするため、動的な削除になる
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete record[key];
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  if (Object.keys(record).length === 0) delete owner[field];
}

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
  const problem = memberNameProblem(name);
  if (problem) throw new CommandError(`"${name}" は名前として使えません: ${problem}`);
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
