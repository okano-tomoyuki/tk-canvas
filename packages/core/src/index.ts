export { isValidIdentifier, type IdentifierProblem } from './identifier.ts';
export type { ExtensionToWebviewMessage, WebviewToExtensionMessage } from './protocol.ts';

export * from './dsl/schema.ts';
export {
  hasErrors,
  type Diagnostic,
  type DiagnosticCode,
  type JsonPath,
  type Severity,
} from './dsl/diagnostics.ts';
export { parseDocument, type ParseResult } from './dsl/parse.ts';
export { validateDocument } from './dsl/validate.ts';
export { serializeDocument } from './dsl/serialize.ts';
export { documentJsonSchema } from './dsl/jsonSchema.ts';
export { containerKindOf, type ContainerKind } from './dsl/placement.ts';
export type { HandlerSignature } from './dsl/signature.ts';

export { findOption, getWidgetCatalog } from './catalog/catalog.ts';
export type {
  ChildrenKind,
  OptionInfo,
  OptionType,
  WidgetCatalog,
  WidgetCategory,
  WidgetClassInfo,
} from './catalog/types.ts';

export { applyCommand, type CommandResult, type EditCommand } from './edit/commands.ts';
export { defaultPlacement, nextMemberName, nextWidgetId } from './edit/defaults.ts';
export { minimalTextEdit, type TextEdit } from './edit/textEdit.ts';
export {
  formatValue,
  parseInteger,
  parseNumber,
  parseNumberList,
  parseOptionInput,
  parsePad,
  type InputResult,
} from './edit/inputs.ts';
export {
  collectMemberNames,
  findNode,
  isDescendantOrSelf,
  jsonPathOf,
  pathTo,
  walkNodes,
  type AnyNode,
  type NodeLocation,
} from './edit/tree.ts';

export { computeLayout, type LayoutOptions } from './layout/engine.ts';
export { findDropTarget, type DropTarget, type Point } from './layout/dropTarget.ts';
export type { Insets, LayoutBox, LayoutMetrics, LayoutResult, Rect, Size } from './layout/types.ts';
export {
  collectHandlers,
  countVariableReferences,
  sequenceToName,
  type HandlerUsage,
} from './edit/members.ts';
