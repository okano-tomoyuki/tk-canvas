/**
 * コード生成 CLI（docs/adr/0010）。
 *
 *   tkd generate <file.tkui.json> [--force] [--check]
 *
 * - DSL の codegen に書かれたターゲット（Python / C++）のコードを生成する。既存のファイルはマーカー区間だけを更新する。
 * - 手で編集された区間があれば書き込まずに失敗する（--force で上書き）。
 * - --check は書き込まず、生成結果が既存のファイルと一致するか（最新か）だけを調べる（CI 向け）。
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { generateAll } from '@tk-designer/codegen';
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

  const outPath = (path: string) => resolve(dirname(dslPath), path);
  const generated = generateAll(document, basename(dslPath), (path) => readIfExists(outPath(path)));
  if ('error' in generated) {
    console.error(`${file}: ${generated.error}`);
    return 1;
  }
  for (const warning of generated.warnings) console.error(`warning: ${warning}`);

  let status = 0;
  for (const { path, result } of generated.files) {
    if (!result.ok) {
      console.error(`${path}: ${result.error}`);
      status = 1;
    }
  }
  if (status !== 0) return status;

  const files = generated.files.flatMap(({ path, result }) =>
    result.ok ? [{ path, result }] : [],
  );
  const existing = new Map(files.map((f) => [f.path, readIfExists(outPath(f.path))]));
  const changed = files.filter((f) => existing.get(f.path) !== f.result.text);

  if (values.check) {
    for (const f of changed)
      console.error(`${f.path}: 最新ではありません（tkd generate を実行してください）`);
    return changed.length > 0 ? 1 : 0;
  }

  const modified = files.filter((f) => f.result.modifiedRegions.length > 0);
  if (modified.length > 0 && !values.force) {
    for (const f of modified) {
      console.error(
        `${f.path}: 自動生成区間（${f.result.modifiedRegions.join(', ')}）が手で編集されています。上書きするには --force を指定してください`,
      );
    }
    return 2;
  }

  for (const f of files) {
    if (!changed.includes(f)) {
      console.log(`${f.path}: 最新です`);
      continue;
    }
    mkdirSync(dirname(outPath(f.path)), { recursive: true });
    writeFileSync(outPath(f.path), f.result.text);
    const stubs =
      f.result.addedStubs.length > 0
        ? `（ハンドラの雛形を追加: ${f.result.addedStubs.join(', ')}）`
        : '';
    console.log(
      `${f.path}: ${existing.get(f.path) === undefined ? '作成' : '更新'}しました${stubs}`,
    );
  }
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
