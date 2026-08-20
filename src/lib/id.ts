import { randomBytes } from "crypto";

export function createId(prefix = ""): string {
  const id = randomBytes(12).toString("hex");
  return prefix ? `${prefix}_${id}` : id;
}

/** Lexicographic rank between two ranks (simple fractional indexing). */
export function rankBetween(before: string | null, after: string | null): string {
  if (!before && !after) return "a0";
  if (!before && after) return beforeRank(after);
  if (before && !after) return afterRank(before);
  if (before === after) return afterRank(before!);

  // Midpoint-ish string between before and after
  const a = before!;
  const b = after!;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (i < a.length && i < b.length) {
    const mid = Math.floor((a.charCodeAt(i) + b.charCodeAt(i)) / 2);
    if (mid > a.charCodeAt(i)) {
      return a.slice(0, i) + String.fromCharCode(mid);
    }
  }
  return afterRank(a);
}

function afterRank(rank: string): string {
  return `${rank}a`;
}

function beforeRank(rank: string): string {
  if (!rank) return "a0";
  const last = rank.charCodeAt(rank.length - 1);
  if (last > 97) {
    return rank.slice(0, -1) + String.fromCharCode(last - 1) + "z";
  }
  return `a${rank}`;
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
