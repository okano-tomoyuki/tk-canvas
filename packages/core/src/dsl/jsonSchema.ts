import * as z from 'zod';
import { TkuiDocument } from './schema.ts';

/**
 * テキストエディタでの補完・検証用の JSON Schema を生成する。
 * VS Code の JSON 言語機能が確実に扱える draft-07 で出力する。
 */
export function documentJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(TkuiDocument, { target: 'draft-7', io: 'input' });
}
