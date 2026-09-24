import type { CodegenSettings, TkuiDocument } from '@tk-designer/core';

/** パスを区切りで分割する（Windows と POSIX の両方の区切りに対応する） */
function pathSegments(path: string): string[] {
  return path.split(/[\\/]/).filter((s) => s !== '');
}

/** パスの最後の要素（ファイル名） */
export function fileNameOf(path: string): string {
  return pathSegments(path).pop() ?? path;
}

/** DSL のファイル名（例: "main_window.tkui.json"）から拡張子を除いた名前（"main_window"） */
export function baseName(dslFileName: string): string {
  return fileNameOf(dslFileName)
    .replace(/\.tkui\.json$/, '')
    .replace(/\.json$/, '');
}

/** "main_window" → "MainWindow"。識別子に使えない文字は区切りとして扱う */
export function toClassName(base: string): string {
  const name = base
    .split(/[^A-Za-z0-9]+/)
    .filter((part) => part !== '')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  if (name === '') return 'MainWindow';
  return /^[0-9]/.test(name) ? `Ui${name}` : name;
}

export interface PythonTarget {
  readonly className: string;
  /** DSL ファイルのあるフォルダからの相対パス */
  readonly file: string;
}

export interface CppTarget {
  readonly className: string;
  readonly header: string;
  readonly source: string;
}

export interface ResolvedTargets {
  readonly python?: PythonTarget;
  readonly cpp?: CppTarget;
}

/** codegen の設定に既定値を補う（docs/adr/0010）。書かれたターゲットだけを返す */
export function resolveTargets(doc: TkuiDocument, dslFileName: string): ResolvedTargets {
  const settings: CodegenSettings = doc.codegen ?? {};
  const base = baseName(dslFileName);
  const className = toClassName(base);
  return {
    ...(settings.python && {
      python: {
        className: settings.python.className ?? className,
        file: settings.python.file ?? `${base}.py`,
      },
    }),
    ...(settings.cpp && {
      cpp: {
        className: settings.cpp.className ?? className,
        header: settings.cpp.header ?? `${base}.hpp`,
        source: settings.cpp.source ?? `${base}.cpp`,
      },
    }),
  };
}

/**
 * from のファイルから見た to のファイルの相対パス（どちらも同じフォルダからの相対パス。区切りは "/"）。
 * C++ のソースからヘッダを include するパスに使う。
 */
export function relativePath(from: string, to: string): string {
  const split = (p: string) => pathSegments(p).filter((s) => s !== '.');
  const fromDir = split(from).slice(0, -1);
  const target = split(to);
  let common = 0;
  while (
    common < fromDir.length &&
    common < target.length - 1 &&
    fromDir[common] === target[common]
  )
    common++;
  return [...fromDir.slice(common).map(() => '..'), ...target.slice(common)].join('/');
}
