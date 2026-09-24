/**
 * マーカー区間の内容のハッシュ（docs/codegen-design.md M2 / M3）。
 * 空白（改行・インデントを含む）を取り除いてから計算するため、フォーマッタによる改行や字下げの違いでは変わらない。
 * 改ざん検知ではなく「手で編集されたか」の検出が目的なので、軽量な FNV-1a（32bit）を使う。
 */
export function regionHash(content: string): string {
  const normalized = content.replace(/\s+/g, '');
  let hash = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
