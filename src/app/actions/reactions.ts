"use server";

import { requireUser } from "@/lib/auth";
import { toggleCommentReaction } from "@/lib/comment-reactions";
import { get } from "@/lib/db";
import { canComment } from "@/lib/permissions";

export async function toggleReactionAction(commentId: string, emoji: string) {
  const user = await requireUser();
  const row = get<{ project_id: string }>(
    `SELECT i.project_id FROM comments c JOIN issues i ON i.id = c.issue_id WHERE c.id = ?`,
    [commentId],
  );
  if (!row) return { error: "Не знайдено." };
  if (!canComment(user, row.project_id)) throw new Error("FORBIDDEN");
  try {
    return { ok: true as const, ...toggleCommentReaction(commentId, user.id, emoji) };
  } catch {
    return { error: "Невірна реакція." };
  }
}
