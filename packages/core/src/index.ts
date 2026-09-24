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
export { containerKindOf, type ContainerKind, type HandlerSignature } from './dsl/interimRules.ts';
