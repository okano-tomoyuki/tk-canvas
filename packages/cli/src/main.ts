/**
 * コード生成 CLI（docs/adr/0010）。
 *
 *   tkd generate <file.tkui.json> [--force] [--check]
 *
 * - DSL の codegen に書かれたターゲットのコードを生成する。既存のファイルはマーカー区間だけを更新する。
 * - 手で編集された区間があれば書き込まずに失敗する（--force で上書き）。
 * - --check は書き込まず、生成結果が既存のファイルと一致するか（最新か）だけを調べる（CI 向け）。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { generatePython, resolveTargets } from '@tk-designer/codegen';
import { parseDocument } from '@tk-designer/core';

const USAGE = 'Usage: tkd generate <file.tkui.json> [--force] [--check]';

function main(argv: readonly string[]): number {
  const { positionals, values } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: { force: { type: 'boolean' }, check: { type: 'boolean' } },
  });
  const [command, file] = positionals;
  if (command !== 'generate' || !file) {
    console.error(USAGE);
    return 1;
  }

  const dslPath = resolve(file);
  const { document, diagnostics } = parseDocument(readFileSync(dslPath, 'utf8'));
  for (const d of diagnostics) {
    console.error(`${file}: ${d.severity}: ${d.path.join('.') || '(root)'}: ${d.message}`);
  }
  if (!document || diagnostics.some((d) => d.severity === 'error')) return 1;

  const targets = resolveTargets(document, basename(dslPath));
  if (!targets.python && !targets.cpp) {
    console.error(`${file}: codegen が設定されていません（例: "codegen": { "python": {} }）`);
    return 1;
  }
  if (targets.cpp) console.error('warning: C++（cpp_tk）のコード生成はまだ実装されていません');
  if (!targets.python) return 0;

  const outPath = resolve(dirname(dslPath), targets.python.file);
  const existing = readIfExists(outPath);
  const result = generatePython(document, basename(dslPath), existing);
  if (!result.ok) {
    console.error(`${targets.python.file}: ${result.error}`);
    return 1;
  }

  if (values.check) {
    if (existing === result.text) return 0;
    console.error(`${targets.python.file}: 最新ではありません（tkd generate を実行してください）`);
    return 1;
  }
  if (result.modifiedRegions.length > 0 && !values.force) {
    console.error(
      `${targets.python.file}: 自動生成区間（${result.modifiedRegions.join(', ')}）が手で編集されています。上書きするには --force を指定してください`,
    );
    return 2;
  }
  if (existing === result.text) {
    console.log(`${targets.python.file}: 最新です`);
    return 0;
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, result.text);
  const stubs =
    result.addedStubs.length > 0 ? `（ハンドラの雛形を追加: ${result.addedStubs.join(', ')}）` : '';
  console.log(
    `${targets.python.file}: ${existing === undefined ? '作成' : '更新'}しました${stubs}`,
  );
  return 0;
}

function readIfExists(path: string): string | undefined {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return undefined;
  }
}

process.exitCode = main(process.argv.slice(2));
