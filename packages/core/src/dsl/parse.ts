import * as z from 'zod';
import type { Diagnostic } from './diagnostics.ts';
import { FORMAT_VERSION, TkuiDocument } from './schema.ts';
import { validateDocument } from './validate.ts';

export interface ParseResult {
  /** 構造の検証を通過した場合のみ存在する（意味の検証でエラーがあっても存在する） */
  readonly document?: TkuiDocument;
  readonly diagnostics: readonly Diagnostic[];
}

const japaneseErrors = z.locales.ja().localeError;

/** *.tkui.json のテキストを読み込み、構造と意味を検証する */
export function parseDocument(text: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { diagnostics: [{ severity: 'error', code: 'json-syntax', message, path: [] }] };
  }

  const version = isObject(json) ? json.formatVersion : undefined;
  if (typeof version === 'number' && version !== FORMAT_VERSION) {
    return {
      diagnostics: [
        {
          severity: 'error',
          code: 'unsupported-version',
          message: `formatVersion ${String(version)} には対応していません（対応: ${String(FORMAT_VERSION)}）`,
          path: ['formatVersion'],
        },
      ],
    };
  }

  const result = TkuiDocument.safeParse(json, { error: japaneseErrors });
  if (!result.success) {
    return {
      diagnostics: result.error.issues.map((issue) => ({
        severity: 'error',
        code: 'schema',
        message: issue.message,
        path: issue.path.map((key) => (typeof key === 'symbol' ? String(key) : key)),
      })),
    };
  }
  return { document: result.data, diagnostics: validateDocument(result.data) };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
