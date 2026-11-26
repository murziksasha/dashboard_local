import { randomBytes } from "crypto";

export function createId(prefix = ""): string {
  const id = randomBytes(12).toString("hex");
  return prefix ? `${prefix}_${id}` : id;
}

/** Lexicographic rank between two ranks (collision-free fractional indexing). */
export function rankBetween(before: string | null, after: string | null): string {
  if (!before && !after) return "a0";
  if (!before && after) return beforeRank(after);
  if (before && !after) return afterRank(before);
  if (before! >= after!) return afterRank(before!);

  const a = before!;
  const b = after!;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;

  if (i === a.length && i < b.length) {
    // a is a strict prefix of b, e.g. "a0" and "a0a"
    let j = i;
    while (j < b.length && b.charCodeAt(j) <= 48) j++;
    if (j >= b.length) return `${a}0`;
    const hi = b.charCodeAt(j);
    const mid = Math.floor((48 + hi) / 2);
    if (mid > 48) {
      return b.slice(0, j) + String.fromCharCode(mid);
    }
    return `${b.slice(0, j)}0H`;
  }

  if (i < a.length && i < b.length) {
    const lo = a.charCodeAt(i);
    const hi = b.charCodeAt(i);
    if (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      return a.slice(0, i) + String.fromCharCode(mid);
    }
    // Adjacent chars at i (e.g. "a0" and "a1", or "a0z" and "a1")
    return afterRank(a);
  }

  return afterRank(a);
}

function afterRank(rank: string): string {
  return `${rank}a`;
}

function prevRankChar(code: number): string | null {
  if (code > 97) return String.fromCharCode(code - 1); // 'b'..'z' -> 'a'..'y'
  if (code === 97) return "9"; // 'a' -> '9'
  if (code > 48) return String.fromCharCode(code - 1); // '1'..'9' -> '0'..'8'
  return null;
}

function beforeRank(rank: string): string {
  if (!rank) return "a0";
  for (let i = 0; i < rank.length; i++) {
    const prev = prevRankChar(rank.charCodeAt(i));
    if (prev !== null) {
      return `${rank.slice(0, i)}${prev}z`;
    }
  }
  return `0${rank}`;
}

/** Compact lexicographic ranks for a whole column after fractional keys grow. */
export function packedRanks(count: number): string[] {
  if (count <= 0) return [];
  const width = Math.max(2, String(Math.max(0, count - 1)).length);
  return Array.from(
    { length: count },
    (_, i) => `b${String(i).padStart(width, "0")}`,
  );
}
