/**
 * 意味の検証（docs/adr/0009 の2段階目）。構造の検証を通過したドキュメントを対象とする。
 */
import { findOption, getWidgetCatalog } from '../catalog/catalog.ts';
import type { WidgetClassInfo } from '../catalog/types.ts';
import { describeIdentifierProblem, isBaseMemberName, isValidIdentifier } from '../identifier.ts';
import type { Diagnostic, DiagnosticCode, JsonPath } from './diagnostics.ts';
import { checkLiteralValue } from './optionValue.ts';
import { containerKindOf, PLACEMENT_SCHEMAS, type ContainerKind } from './placement.ts';
import {
  isWindowClass,
  type OptionValue,
  type RootNode,
  type TkuiDocument,
  type WidgetNode,
} from './schema.ts';
import type { HandlerSignature } from './signature.ts';

const SIGNATURE_LABELS: Readonly<Record<HandlerSignature, string>> = {
  none: '引数なし',
  value: '値を受け取る',
  event: 'イベントを受け取る',
};

type NameKind = 'widget' | 'variable' | 'handler';

const NAME_KIND_LABELS: Readonly<Record<NameKind, string>> = {
  widget: 'ウィジェット',
  variable: '変数',
  handler: 'ハンドラ',
};

interface HandlerUsage {
  readonly name: string;
  readonly signature: HandlerSignature;
  readonly path: JsonPath;
}

export function validateDocument(doc: TkuiDocument): Diagnostic[] {
  return new Validator(doc).run();
}

class Validator {
  private readonly doc: TkuiDocument;
  private readonly diagnostics: Diagnostic[] = [];
  /** 生成コードのクラスメンバ名になる名前（ウィジェット・変数・ハンドラは同じ名前空間を共有する） */
  private readonly names = new Map<string, NameKind>();
  private readonly handlerUsages: HandlerUsage[] = [];
  private readonly usedVariables = new Set<string>();

  constructor(doc: TkuiDocument) {
    this.doc = doc;
  }

  run(): Diagnostic[] {
    for (const target of ['python', 'cpp'] as const) {
      const className = this.doc.codegen?.[target]?.className;
      const problem = className === undefined ? null : isValidIdentifier(className);
      if (className !== undefined && problem) {
        this.report(
          'invalid-identifier',
          ['codegen', target, 'className'],
          `"${className}": ${describeIdentifierProblem(problem)}`,
        );
      }
    }
    for (const name of Object.keys(this.doc.variables ?? {})) {
      this.declareName(name, 'variable', ['variables', name]);
    }
    this.visitRoot(this.doc.root);
    this.checkHandlers();
    this.checkUnusedVariables();
    return this.diagnostics;
  }

  private report(
    code: DiagnosticCode,
    path: JsonPath,
    message: string,
    severity: 'error' | 'warning' = 'error',
  ) {
    this.diagnostics.push({ severity, code, message, path });
  }

  /**
   * @param member 生成クラスのメンバになる名前か（ルートの id はメンバにならない）
   */
  private declareName(name: string, kind: NameKind, path: JsonPath, member = true) {
    if (member) this.checkMemberName(name, path);
    const existing = this.names.get(name);
    if (existing) {
      this.report(
        'duplicate-name',
        path,
        `"${name}" は${NAME_KIND_LABELS[existing]}の名前として既に使われています（ウィジェット・変数・ハンドラの名前は重複できません）`,
      );
      return;
    }
    this.names.set(name, kind);
  }

  private checkMemberName(name: string, path: JsonPath) {
    const problem = isValidIdentifier(name);
    if (problem) {
      this.report('invalid-identifier', path, `"${name}": ${describeIdentifierProblem(problem)}`);
    } else if (isBaseMemberName(name)) {
      this.report(
        'reserved-name',
        path,
        `"${name}": 生成されるクラスの基底クラス（Tk・Frame など）のメンバと同じ名前は使用できません`,
      );
    }
  }

  // ---- ノード -------------------------------------------------------------

  private visitRoot(root: RootNode) {
    const path: JsonPath = ['root'];
    // ルートの id は生成クラスのメンバにならない（生成クラス自身がルート。docs/adr/0011）が、
    // デザイナー上でウィジェットを指す名前として、他の名前との重複は認めない
    this.declareName(root.id, 'widget', [...path, 'id'], false);
    if (root.window && !isWindowClass(root.class)) {
      this.report(
        'window-not-allowed',
        [...path, 'window'],
        `${root.class} はウィンドウではないため、window は指定できません`,
      );
    }
    this.visitCommon(root, path);
  }

  private visitWidget(node: WidgetNode, path: JsonPath, parentKind: ContainerKind | undefined) {
    this.declareName(node.id, 'widget', [...path, 'id']);

    if (isWindowClass(node.class)) {
      this.report(
        'invalid-child-class',
        [...path, 'class'],
        `${node.class} はルートにのみ使用できます`,
      );
    }
    if (node.placement && parentKind) {
      this.checkPlacement(node.placement, [...path, 'placement'], parentKind);
    }
    this.visitCommon(node, path);
  }

  private visitCommon(node: RootNode | WidgetNode, path: JsonPath) {
    const widgetClass = getWidgetCatalog().classes.get(node.class);
    if (!widgetClass) {
      this.report('unknown-class', [...path, 'class'], `${node.class} はカタログにないクラスです`);
    }

    if (widgetClass) {
      for (const [key, value] of Object.entries(node.options ?? {})) {
        this.checkOption(widgetClass, key, value, [...path, 'options', key]);
      }
      if (node.layout && widgetClass.children !== 'layout') {
        this.report(
          'layout-not-allowed',
          [...path, 'layout'],
          widgetClass.children
            ? `${node.class} は子の置き方がクラスで決まるため、layout は指定できません`
            : `${node.class} は子を持てないため、layout は指定できません`,
        );
      }
    }
    node.bindings?.forEach((binding, i) => {
      this.handlerUsages.push({
        name: binding.handler,
        signature: 'event',
        path: [...path, 'bindings', i, 'handler'],
      });
    });

    const children = node.children ?? [];
    if (children.length === 0) return;

    const kind = containerKindOf(node);
    if (widgetClass && !widgetClass.children) {
      this.report('children-not-allowed', [...path, 'children'], `${node.class} は子を持てません`);
    } else if (widgetClass && !kind) {
      this.report(
        'missing-layout',
        [...path, 'children'],
        '子を持つには layout（manager）を指定する必要があります',
      );
    }
    children.forEach((child, i) => {
      this.visitWidget(child, [...path, 'children', i], kind);
    });
  }

  // ---- オプション ---------------------------------------------------------

  private checkOption(
    widgetClass: WidgetClassInfo,
    key: string,
    value: OptionValue,
    path: JsonPath,
  ) {
    const found = findOption(widgetClass, key);
    if (!found) {
      this.report(
        'unknown-option',
        path,
        `${widgetClass.name} に ${key} というオプションはありません`,
      );
      return;
    }
    if (found.isAlias) {
      this.report(
        'option-alias',
        path,
        `${key} は別名です。正式名 ${found.option.name} で指定してください`,
      );
      return;
    }
    const type = found.option.type;

    if (typeof value === 'object' && 'var' in value) {
      if (type.kind !== 'variable') {
        this.report('misplaced-reference', path, `${key} には変数参照を指定できません`);
        return;
      }
      this.usedVariables.add(value.var);
      const variable = this.doc.variables?.[value.var];
      if (!variable) {
        this.report(
          'unknown-variable',
          [...path, 'var'],
          `変数 "${value.var}" は variables に定義されていません`,
        );
      } else if (!type.variableTypes.includes(variable.type)) {
        this.report(
          'variable-type-mismatch',
          [...path, 'var'],
          `${key} には ${type.variableTypes.join(' / ')} を指定する必要があります（"${value.var}" は ${variable.type}）`,
        );
      }
      return;
    }

    if (typeof value === 'object' && 'handler' in value) {
      if (type.kind !== 'callback') {
        this.report('misplaced-reference', path, `${key} にはハンドラ参照を指定できません`);
        return;
      }
      if (!type.signature) {
        this.report('misplaced-reference', path, `${key} へのハンドラ参照にはまだ対応していません`);
        return;
      }
      this.handlerUsages.push({
        name: value.handler,
        signature: type.signature,
        path: [...path, 'handler'],
      });
      return;
    }

    if (type.kind === 'variable') {
      this.report(
        'reference-required',
        path,
        `${key} は { "var": "変数名" } の形式で指定する必要があります`,
      );
      return;
    }
    if (type.kind === 'callback') {
      this.report(
        'reference-required',
        path,
        `${key} は { "handler": "メソッド名" } の形式で指定する必要があります`,
      );
      return;
    }
    const problem = checkLiteralValue(type, value);
    if (problem) {
      this.report('invalid-option-value', path, `${key}: ${problem}`);
    }
  }

  // ---- placement ----------------------------------------------------------

  private checkPlacement(placement: object, path: JsonPath, parentKind: ContainerKind) {
    const result = PLACEMENT_SCHEMAS[parentKind].safeParse(placement);
    if (result.success) return;
    const keys = result.error.issues.flatMap((issue) =>
      issue.code === 'unrecognized_keys' ? issue.keys : [],
    );
    const detail = keys.length > 0 ? `${keys.join(', ')} は指定できません` : '値が不正です';
    this.report(
      'placement-mismatch',
      path,
      `親の配置方法（${parentKind}）の placement として不正です: ${detail}`,
    );
  }

  // ---- ハンドラ・変数 ------------------------------------------------------

  private checkHandlers() {
    const firstUsage = new Map<string, HandlerUsage>();
    for (const usage of this.handlerUsages) {
      const first = firstUsage.get(usage.name);
      if (!first) {
        firstUsage.set(usage.name, usage);
        this.declareName(usage.name, 'handler', usage.path);
      } else if (first.signature !== usage.signature) {
        this.report(
          'handler-signature-conflict',
          usage.path,
          `ハンドラ "${usage.name}" は別の箇所で「${SIGNATURE_LABELS[first.signature]}」として使われているため、「${SIGNATURE_LABELS[usage.signature]}」としては使えません`,
        );
      }
    }
  }

  private checkUnusedVariables() {
    for (const name of Object.keys(this.doc.variables ?? {})) {
      if (!this.usedVariables.has(name)) {
        this.report(
          'unused-variable',
          ['variables', name],
          `変数 "${name}" はどこからも参照されていません`,
          'warning',
        );
      }
    }
  }
}
