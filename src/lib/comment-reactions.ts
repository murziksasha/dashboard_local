import { all, nowIso, run } from "./db";
import { REACTION_EMOJI } from "./reaction-emoji";

const ALLOWED = new Set<string>(REACTION_EMOJI);

export type ReactionCount = { emoji: string; count: number; mine: boolean };

export function listCommentReactions(
  commentIds: string[],
  userId: string,
): Record<string, ReactionCount[]> {
  const map: Record<string, ReactionCount[]> = {};
  if (!commentIds.length) return map;
  const rows = all<{ comment_id: string; emoji: string; user_id: string }>(
    `SELECT comment_id, emoji, user_id FROM comment_reactions
     WHERE comment_id IN (${commentIds.map(() => "?").join(",")})`,
    commentIds,
  );
  const agg = new Map<string, { count: number; mine: boolean }>();
  for (const row of rows) {
    const key = `${row.comment_id}\0${row.emoji}`;
    const cur = agg.get(key) || { count: 0, mine: false };
    cur.count += 1;
    if (row.user_id === userId) cur.mine = true;
    agg.set(key, cur);
  }
  for (const [key, val] of agg) {
    const [commentId, emoji] = key.split("\0");
    (map[commentId!] ??= []).push({ emoji: emoji!, ...val });
  }
  return map;
}

export function toggleCommentReaction(commentId: string, userId: string, emoji: string) {
  if (!ALLOWED.has(emoji)) throw new Error("INVALID_EMOJI");
  const existing = all<{ user_id: string }>(
    `SELECT user_id FROM comment_reactions WHERE comment_id = ? AND user_id = ? AND emoji = ?`,
    [commentId, userId, emoji],
  )[0];
  if (existing) {
    run(`DELETE FROM comment_reactions WHERE comment_id = ? AND user_id = ? AND emoji = ?`, [
      commentId,
      userId,
      emoji,
    ]);
    return { on: false };
  }
  run(
    `INSERT INTO comment_reactions (comment_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?)`,
    [commentId, userId, emoji, nowIso()],
  );
  return { on: true };
}

export { REACTION_EMOJI };
