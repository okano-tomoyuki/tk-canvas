/**
 * コード生成（docs/codegen-design.md、docs/adr/0010）。
 * 文字列を受け取り文字列を返すだけで、ファイルの入出力は呼び出し側（拡張機能・CLI）が行う。
 */
import type { TkuiDocument } from '@tk-designer/core';
import { emitCpp } from './cpp/emit.ts';
import { cppSyntax } from './cpp/syntax.ts';
import { buildModel } from './model.ts';
import { fileNameOf, relativePath, resolveTargets } from './names.ts';
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

export interface CppGenerateResult {
  readonly header: GenerateResult;
  readonly source: GenerateResult;
  /** 生成したコードに反映できなかった指定 */
  readonly warnings: readonly string[];
}

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
  const sourceName = fileNameOf(dslFileName);
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

/**
 * C++（cpp_tk）のコードを生成する。ヘッダとソースのそれぞれについて、既存の内容があればマーカー区間だけを置き換える。
 */
export function generateCpp(
  doc: TkuiDocument,
  dslFileName: string,
  existingHeader: string | undefined,
  existingSource: string | undefined,
): CppGenerateResult | { readonly error: string } {
  const target = resolveTargets(doc, dslFileName).cpp;
  if (!target) return { error: 'codegen.cpp が設定されていません' };
  const sourceName = fileNameOf(dslFileName);
  const files = emitCpp(
    buildModel(doc, target.className),
    sourceName,
    relativePath(target.source, target.header),
  );
  const syntax = cppSyntax(target.className);
  const generate = (
    code: typeof files.header,
    existing: string | undefined,
    path: string,
  ): GenerateResult =>
    existing === undefined
      ? { ok: true, text: createFile(code, syntax), modifiedRegions: [], addedStubs: [], path }
      : { ...mergeFile(existing, code, syntax), path };
  return {
    header: generate(files.header, existingHeader, target.header),
    source: generate(files.source, existingSource, target.source),
    warnings: files.warnings,
  };
}

/** 出力する1ファイル分の生成結果 */
export interface OutputFile {
  /** DSL ファイルのあるフォルダからの相対パス */
  readonly path: string;
  readonly result: MergeResult;
}

export interface GenerateAllResult {
  readonly files: readonly OutputFile[];
  readonly warnings: readonly string[];
}

/**
 * codegen に書かれたすべてのターゲットのコードを生成する（拡張機能・CLI の共通の入口）。
 * @param readExisting 出力先の既存の内容を返す（なければ undefined）
 */
export function generateAll(
  doc: TkuiDocument,
  dslFileName: string,
  readExisting: (path: string) => string | undefined,
): GenerateAllResult | { readonly error: string } {
  const targets = resolveTargets(doc, dslFileName);
  if (!targets.python && !targets.cpp) {
    return { error: 'codegen が設定されていません（例: "codegen": { "python": {} }）' };
  }
  const files: OutputFile[] = [];
  const warnings: string[] = [];
  if (targets.python) {
    const result = generatePython(doc, dslFileName, readExisting(targets.python.file));
    files.push({ path: targets.python.file, result });
  }
  if (targets.cpp) {
    const result = generateCpp(
      doc,
      dslFileName,
      readExisting(targets.cpp.header),
      readExisting(targets.cpp.source),
    );
    if ('error' in result) return result;
    files.push({ path: targets.cpp.header, result: result.header });
    files.push({ path: targets.cpp.source, result: result.source });
    warnings.push(...result.warnings);
  }
  return { files, warnings };
}
