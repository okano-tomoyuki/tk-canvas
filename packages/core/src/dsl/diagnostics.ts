/** JSON 上の位置。例: ["root", "children", 2, "placement", "row"] */
export type JsonPath = readonly (string | number)[];

export type Severity = 'error' | 'warning';

export type DiagnosticCode =
  // 読み込み・構造
  | 'json-syntax'
  | 'unsupported-version'
  | 'schema'
  // 名前
  | 'invalid-identifier'
  | 'duplicate-name'
  // 参照
  | 'unknown-variable'
  | 'variable-type-mismatch'
  | 'misplaced-reference'
  | 'reference-required'
  | 'handler-signature-conflict'
  // 構造上の制約
  | 'invalid-child-class'
  | 'layout-not-allowed'
  | 'missing-layout'
  | 'placement-mismatch'
  // 警告
  | 'unused-variable';

export interface Diagnostic {
  readonly severity: Severity;
  readonly code: DiagnosticCode;
  readonly message: string;
  readonly path: JsonPath;
}

export function hasErrors(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === 'error');
}
