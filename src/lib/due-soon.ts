import { all, get, nowIso, settingGet, settingSet } from "./db";
import { notifyUser } from "./notifications";

/**
 * Notify assignees/watchers about issues due within N days (default 2).
 * Runs at most once per calendar day per process/DB.
 */
export function runDueSoonNotifications(withinDays = 2): number {
  const today = nowIso().slice(0, 10);
  const last = settingGet("due_soon_last_run");
  if (last === today) return 0;

  const until = all<{ d: string }>(
    `SELECT date('now', ? || ' day') as d`,
    [`+${withinDays}`],
  )[0]?.d;

  const issues = all<{
    id: string;
    key: string;
    title: string;
    project_id: string;
    due_date: string;
  }>(
    `SELECT i.id, i.key, i.title, i.project_id, i.due_date
     FROM issues i
     JOIN statuses s ON s.id = i.status_id
     WHERE i.due_date IS NOT NULL
       AND i.due_date >= date('now')
       AND i.due_date <= ?
       AND s.category != 'done'
       AND i.deleted_at IS NULL`,
    [until],
  );

  let count = 0;
  for (const issue of issues) {
    const recipients = new Set<string>();
    const assignees = all<{ user_id: string }>(
      `SELECT user_id FROM issue_assignees WHERE issue_id = ?`,
      [issue.id],
    );
    for (const a of assignees) recipients.add(a.user_id);
    const watchers = all<{ user_id: string }>(
      `SELECT user_id FROM watchers WHERE issue_id = ?`,
      [issue.id],
    );
    for (const w of watchers) recipients.add(w.user_id);

    for (const userId of recipients) {
      const already = get(
        `SELECT id FROM notifications
         WHERE user_id = ? AND type = 'due_soon' AND link LIKE ?
           AND date(created_at) = date('now')
         LIMIT 1`,
        [userId, `%/issues/${issue.id}%`],
      );
      if (already) continue;
      notifyUser({
        userId,
        type: "due_soon",
        title: `${issue.key}: дедлайн ${issue.due_date}`,
        body: issue.title,
        link: `/projects/${issue.project_id}/issues/${issue.id}`,
      });
      count++;
    }
  }

  settingSet("due_soon_last_run", today);
  return count;
}
