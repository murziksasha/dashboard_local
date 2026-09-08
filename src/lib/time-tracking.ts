import { all } from "./db";

export type TimePoint = { day: string; seconds: number };
export type TimeUserRow = { user_id: string; name: string; seconds: number };

export function worklogByDay(projectId: string, days = 14): TimePoint[] {
  return all<TimePoint>(
    `SELECT w.work_date as day, SUM(w.seconds) as seconds
     FROM worklogs w
     JOIN issues i ON i.id = w.issue_id
     WHERE i.project_id = ? AND i.deleted_at IS NULL
       AND w.work_date >= date('now', ?)
     GROUP BY w.work_date
     ORDER BY w.work_date`,
    [projectId, `-${days} day`],
  );
}

export function worklogByUser(projectId: string, days = 14): TimeUserRow[] {
  return all<TimeUserRow>(
    `SELECT w.user_id, u.name, SUM(w.seconds) as seconds
     FROM worklogs w
     JOIN issues i ON i.id = w.issue_id
     JOIN users u ON u.id = w.user_id
     WHERE i.project_id = ? AND i.deleted_at IS NULL
       AND w.work_date >= date('now', ?)
     GROUP BY w.user_id
     ORDER BY seconds DESC`,
    [projectId, `-${days} day`],
  );
}

export function myWorklogByDay(userId: string, days = 14): TimePoint[] {
  return all<TimePoint>(
    `SELECT work_date as day, SUM(seconds) as seconds
     FROM worklogs
     WHERE user_id = ? AND work_date >= date('now', ?)
     GROUP BY work_date
     ORDER BY work_date`,
    [userId, `-${days} day`],
  );
}
