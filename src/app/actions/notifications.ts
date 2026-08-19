"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { all, nowIso, run } from "@/lib/db";
import { getUnreadCount } from "@/lib/notifications";

export async function listNotificationsAction() {
  const user = await requireUser();
  const items = all<{
    id: string;
    type: string;
    title: string;
    body: string | null;
    link: string | null;
    read_at: string | null;
    created_at: string;
  }>(
    `SELECT id, type, title, body, link, read_at, created_at
     FROM notifications WHERE user_id = ?
     ORDER BY created_at DESC LIMIT 40`,
    [user.id],
  );
  return { items, unread: getUnreadCount(user.id) };
}

export async function markNotificationReadAction(id: string) {
  const user = await requireUser();
  run(
    `UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL`,
    [nowIso(), id, user.id],
  );
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function markAllNotificationsReadAction() {
  const user = await requireUser();
  run(
    `UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL`,
    [nowIso(), user.id],
  );
  revalidatePath("/dashboard");
  return { ok: true };
}
