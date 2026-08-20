import { createId } from "./id";
import { all, nowIso, run, settingGet } from "./db";
import { emitAppEvent } from "./events";
import { dispatchExternalNotification } from "./notify-channels";

export function notifyUser(params: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
}) {
  try {
    const raw = settingGet(`notify_prefs_${params.userId}`);
    if (raw) {
      const prefs = JSON.parse(raw) as Record<string, boolean>;
      if (prefs[params.type] === false) return;
    }
  } catch {
    // ignore bad prefs
  }
  run(
    `INSERT INTO notifications (id, user_id, type, title, body, link, read_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
    [
      createId("ntf"),
      params.userId,
      params.type,
      params.title,
      params.body ?? null,
      params.link ?? null,
      nowIso(),
    ],
  );
  emitAppEvent({
    type: "notification",
    userId: params.userId,
    payload: { title: params.title, body: params.body, link: params.link },
  });
  // fire-and-forget external channels
  void dispatchExternalNotification({
    userId: params.userId,
    title: params.title,
    body: params.body,
    link: params.link,
  });
}

export function notifyMany(
  userIds: string[],
  payload: Omit<Parameters<typeof notifyUser>[0], "userId">,
) {
  const unique = [...new Set(userIds.filter(Boolean))];
  for (const userId of unique) {
    notifyUser({ ...payload, userId });
  }
}

export function getUnreadCount(userId: string): number {
  const row = all<{ c: number }>(
    `SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND read_at IS NULL`,
    [userId],
  )[0];
  return row?.c ?? 0;
}

export function extractMentions(text: string): string[] {
  const matches = text.matchAll(/@([\p{L}\p{N}._-]+)/gu);
  return [...new Set([...matches].map((m) => m[1]))];
}
