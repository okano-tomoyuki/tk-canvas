/**
 * core のスキーマから JSON Schema を生成する（docs/adr/0009）。
 *   node scripts/generate-json-schema.mts          … 生成して書き込む
 *   node scripts/generate-json-schema.mts --check  … コミット済みのファイルが最新か検査する
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { documentJsonSchema } from '@tk-designer/core';

const outFile = new URL('../schema/tkui.schema.json', import.meta.url);
const generated = `${JSON.stringify(documentJsonSchema(), null, 2)}\n`;

if (process.argv.includes('--check')) {
  const current = await readFile(outFile, 'utf8').catch(() => '');
  if (current.replace(/\r\n/g, '\n') !== generated) {
    console.error(
      'schema/tkui.schema.json が最新ではありません。`pnpm generate:schema` を実行してください。',
    );
    process.exitCode = 1;
  }
} else {
  await writeFile(outFile, generated);
  console.log(`生成しました: ${fileURLToPath(outFile)}`);
}
