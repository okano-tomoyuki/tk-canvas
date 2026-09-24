/**
 * 意味の検証（docs/adr/0009 の2段階目）。構造の検証を通過したドキュメントを対象とする。
 */
import { isValidIdentifier, type IdentifierProblem } from '../identifier.ts';
import type { Diagnostic, DiagnosticCode, JsonPath } from './diagnostics.ts';
import {
  commandSignatureOf,
  containerKindOf,
  HANDLER_OPTIONS,
  isImplicitContainer,
  PLACEMENT_SCHEMAS,
  VARIABLE_OPTIONS,
  type ContainerKind,
  type HandlerSignature,
} from './interimRules.ts';
import {
  ROOT_CLASSES,
  type OptionValue,
  type RootNode,
  type TkuiDocument,
  type WidgetNode,
} from './schema.ts';

const IDENTIFIER_PROBLEM_MESSAGES: Readonly<Record<IdentifierProblem, string>> = {
  empty: '空にはできません',
  'invalid-characters': '英字・数字・_ のみ使用でき、数字で始めることはできません',
  'cpp-keyword': 'C++ のキーワードは使用できません',
  'python-keyword': 'Python のキーワードは使用できません',
  'reserved-prefix': '"tkd_" で始まる名前は予約されています',
  'cpp-reserved': '"__" を含む名前と "_" + 大文字で始まる名前は C++ で予約されています',
};

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

  private declareName(name: string, kind: NameKind, path: JsonPath) {
    const problem = isValidIdentifier(name);
    if (problem) {
      this.report('invalid-identifier', path, `"${name}": ${IDENTIFIER_PROBLEM_MESSAGES[problem]}`);
    }
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

  // ---- ノード -------------------------------------------------------------

  private visitRoot(root: RootNode) {
    const path: JsonPath = ['root'];
    this.declareName(root.id, 'widget', [...path, 'id']);
    this.visitCommon(root, path);
  }

  private visitWidget(node: WidgetNode, path: JsonPath, parentKind: ContainerKind | undefined) {
    this.declareName(node.id, 'widget', [...path, 'id']);

    if ((ROOT_CLASSES as readonly string[]).includes(node.class)) {
      this.report(
        'invalid-child-class',
        [...path, 'class'],
        `${node.class} はルートにのみ使用できます`,
      );
    }
    if (node.layout && isImplicitContainer(node.class)) {
      this.report(
        'layout-not-allowed',
        [...path, 'layout'],
        `${node.class} は子の置き方がクラスで決まるため、layout は指定できません`,
      );
    }
    if (node.placement && parentKind) {
      this.checkPlacement(node.placement, [...path, 'placement'], parentKind);
    }
    this.visitCommon(node, path);
  }

  private visitCommon(node: RootNode | WidgetNode, path: JsonPath) {
    for (const [key, value] of Object.entries(node.options ?? {})) {
      this.checkOption(node.class, key, value, [...path, 'options', key]);
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
    if (!kind) {
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

  private checkOption(className: string, key: string, value: OptionValue, path: JsonPath) {
    const allowedVariableTypes = VARIABLE_OPTIONS[key];
    const acceptsHandler = HANDLER_OPTIONS.has(key);

    if (typeof value === 'object' && 'var' in value) {
      if (!allowedVariableTypes) {
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
      } else if (!allowedVariableTypes.includes(variable.type)) {
        this.report(
          'variable-type-mismatch',
          [...path, 'var'],
          `${key} には ${allowedVariableTypes.join(' / ')} を指定する必要があります（"${value.var}" は ${variable.type}）`,
        );
      }
      return;
    }

    if (typeof value === 'object' && 'handler' in value) {
      if (!acceptsHandler) {
        this.report('misplaced-reference', path, `${key} にはハンドラ参照を指定できません`);
        return;
      }
      this.handlerUsages.push({
        name: value.handler,
        signature: commandSignatureOf(className),
        path: [...path, 'handler'],
      });
      return;
    }

    if (allowedVariableTypes) {
      this.report(
        'reference-required',
        path,
        `${key} は { "var": "変数名" } の形式で指定する必要があります`,
      );
    } else if (acceptsHandler) {
      this.report(
        'reference-required',
        path,
        `${key} は { "handler": "メソッド名" } の形式で指定する必要があります`,
      );
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
