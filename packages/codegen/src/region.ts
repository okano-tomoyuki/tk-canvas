/**
 * マーカー区間の書き出しと、既存のファイルへのマージ（docs/adr/0004、docs/codegen-design.md）。
 *
 *   # <tk-designer:begin id="tkd_create_widgets">
 *   ...（生成したコード）
 *   # <tk-designer:end id="tkd_create_widgets" hash="1a2b3c4d">
 *
 * - 区間の中身は毎回置き換える。hash が中身と合わなければ、利用者が手で編集したものとして知らせる（M2 / M3）。
 * - マーカーの欠落・重複・入れ子・対応の誤りがあれば、何も書き込まずにエラーにする（M4）。
 * - ハンドラの雛形は、まだ定義されていないものだけを 1行マーカー <tk-designer:handler-stubs> の直後に追記する（M1 / M10）。
 */
import { regionHash } from './hash.ts';

export interface Region {
  readonly id: string;
  /** 区間の中身（字下げ済み。末尾の改行なし） */
  readonly content: string;
  /** マーカー行の字下げの深さ */
  readonly indent: number;
}

export interface HandlerStub {
  readonly name: string;
  /** 字下げ済みのコード（末尾の改行なし） */
  readonly code: string;
}

export interface GeneratedCode {
  readonly regions: readonly Region[];
  readonly stubs: readonly HandlerStub[];
  /** 新規ファイルの内容。rendered(id) はマーカーつきの区間 */
  readonly scaffold: (rendered: (id: string) => string) => string;
}

export interface LanguageSyntax {
  /** 行コメントの開始（"#" / "//"） */
  readonly comment: string;
  readonly indentUnit: string;
  /** 既存のファイルにハンドラ name が定義済みか */
  readonly hasHandler: (text: string, name: string) => boolean;
  /** stubs マーカーがないときの追記位置（行番号。この行の前に挿入する） */
  readonly fallbackStubLine: (lines: readonly string[]) => number;
}

export type MergeResult =
  | {
      readonly ok: true;
      readonly text: string;
      /** 手で編集されていた（上書きした）区間の id */
      readonly modifiedRegions: readonly string[];
      /** 追記したハンドラの雛形 */
      readonly addedStubs: readonly string[];
    }
  | { readonly ok: false; readonly error: string };

const STUBS_MARKER = '<tk-designer:handler-stubs>';

export function renderRegion(region: Region, syntax: LanguageSyntax): string {
  const indent = syntax.indentUnit.repeat(region.indent);
  const hash = regionHash(region.content);
  return [
    `${indent}${syntax.comment} <tk-designer:begin id="${region.id}">`,
    region.content,
    `${indent}${syntax.comment} <tk-designer:end id="${region.id}" hash="${hash}">`,
  ].join('\n');
}

/** 新規ファイルを作る */
export function createFile(generated: GeneratedCode, syntax: LanguageSyntax): string {
  const byId = new Map(generated.regions.map((r) => [r.id, r]));
  return generated.scaffold((id) => {
    const region = byId.get(id);
    if (!region) throw new Error(`unknown region: ${id}`);
    return renderRegion(region, syntax);
  });
}

interface ParsedRegion {
  readonly id: string;
  readonly begin: number;
  readonly end: number;
  readonly hash: string | undefined;
}

const BEGIN = /^\s*(?:#|\/\/)\s*<tk-designer:begin id="([^"]+)">\s*$/;
const END = /^\s*(?:#|\/\/)\s*<tk-designer:end id="([^"]+)"(?: hash="([0-9a-f]*)")?>\s*$/;

function parseRegions(lines: readonly string[]): ParsedRegion[] | string {
  const regions: ParsedRegion[] = [];
  let open: { id: string; begin: number } | undefined;
  for (const [i, line] of lines.entries()) {
    const begin = BEGIN.exec(line);
    if (begin) {
      if (open)
        return `${String(i + 1)} 行目: 区間 "${open.id}" が閉じる前に "${begin[1] ?? ''}" が始まっています`;
      open = { id: begin[1] ?? '', begin: i };
      continue;
    }
    const end = END.exec(line);
    if (end) {
      if (!open || open.id !== end[1]) {
        return `${String(i + 1)} 行目: 区間 "${end[1] ?? ''}" の終了マーカーに対応する開始マーカーがありません`;
      }
      if (regions.some((r) => r.id === open?.id)) return `区間 "${open.id}" が重複しています`;
      regions.push({ id: open.id, begin: open.begin, end: i, hash: end[2] });
      open = undefined;
    }
  }
  if (open) return `区間 "${open.id}" の終了マーカーがありません`;
  return regions;
}

/** 既存のファイルのマーカー区間を置き換え、足りないハンドラの雛形を追記する */
export function mergeFile(
  existing: string,
  generated: GeneratedCode,
  syntax: LanguageSyntax,
): MergeResult {
  const eol = existing.includes('\r\n') ? '\r\n' : '\n';
  const lines = existing.split(/\r?\n/);
  const parsed = parseRegions(lines);
  if (typeof parsed === 'string')
    return { ok: false, error: `マーカーが壊れているため書き込みませんでした: ${parsed}` };

  const missing = generated.regions.filter((r) => !parsed.some((p) => p.id === r.id));
  if (missing.length > 0) {
    return {
      ok: false,
      error: `マーカー区間が見つからないため書き込みませんでした: ${missing.map((r) => r.id).join(', ')}`,
    };
  }

  const modifiedRegions = parsed
    .filter((p) => generated.regions.some((r) => r.id === p.id))
    .filter((p) => p.hash !== regionHash(lines.slice(p.begin + 1, p.end).join('\n')))
    .map((p) => p.id);

  // 後ろの区間から置き換えると、前の区間の行番号がずれない
  const output = [...lines];
  for (const p of [...parsed].sort((a, b) => b.begin - a.begin)) {
    const region = generated.regions.find((r) => r.id === p.id);
    if (!region) continue; // 未知の区間（新しいバージョンの生成物など）はそのまま残す
    output.splice(p.begin, p.end - p.begin + 1, ...renderRegion(region, syntax).split('\n'));
  }

  // まだ定義されていないハンドラの雛形を追記する（削除はしない）
  const current = output.join('\n');
  const newStubs = generated.stubs.filter((s) => !syntax.hasHandler(current, s.name));
  if (newStubs.length > 0) {
    const markerLine = output.findIndex((l) => l.includes(STUBS_MARKER));
    const insertAt = markerLine >= 0 ? markerLine + 1 : syntax.fallbackStubLine(output);
    const stubLines = newStubs.flatMap((s) => ['', ...s.code.split('\n')]);
    output.splice(insertAt, 0, ...stubLines);
  }

  return {
    ok: true,
    text: output.join(eol),
    modifiedRegions,
    addedStubs: newStubs.map((s) => s.name),
  };
}
