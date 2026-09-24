/**
 * コード生成（docs/codegen-design.md、docs/adr/0010）。
 * 文字列を受け取り文字列を返すだけで、ファイルの入出力は呼び出し側（拡張機能・CLI）が行う。
 */
import type { TkuiDocument } from '@tk-designer/core';
import { buildModel } from './model.ts';
import { resolveTargets } from './names.ts';
import { emitPython } from './python/emit.ts';
import { PYTHON_SYNTAX } from './python/syntax.ts';
import { createFile, mergeFile, type MergeResult } from './region.ts';

export { regionHash } from './hash.ts';
export {
  baseName,
  resolveTargets,
  toClassName,
  type CppTarget,
  type PythonTarget,
  type ResolvedTargets,
} from './names.ts';
export type { MergeResult } from './region.ts';

/** 生成ターゲット（docs/adr/0002） */
export type Target = 'cpp' | 'python';

export const TARGETS: readonly Target[] = ['cpp', 'python'];

export type GenerateResult = MergeResult & {
  /** 出力先（DSL ファイルのあるフォルダからの相対パス） */
  readonly path?: string;
};

/**
 * Python のコードを生成する。existing があればマーカー区間だけを置き換え、なければ新規ファイルを作る。
 * @param doc 検証を通過したドキュメント
 * @param dslFileName DSL のファイル名（クラス名・出力先の既定値と、生成物の説明に使う）
 * @param existing 出力先の既存の内容（なければ undefined）
 */
export function generatePython(
  doc: TkuiDocument,
  dslFileName: string,
  existing: string | undefined,
): GenerateResult {
  const target = resolveTargets(doc, dslFileName).python;
  if (!target) return { ok: false, error: 'codegen.python が設定されていません' };
  const sourceName = dslFileName.split(/[\\/]/).pop() ?? dslFileName;
  const generated = emitPython(buildModel(doc, target.className), sourceName);
  if (existing === undefined) {
    return {
      ok: true,
      text: createFile(generated, PYTHON_SYNTAX),
      modifiedRegions: [],
      addedStubs: [],
      path: target.file,
    };
  }
  return { ...mergeFile(existing, generated, PYTHON_SYNTAX), path: target.file };
}
