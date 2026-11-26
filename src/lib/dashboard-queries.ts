import { all, count } from "./db";
import { listProjectsForUser } from "./projects";
import type { Priority, SessionUser } from "./types";

const PROJECT_ACCESS_SQL = `
  JOIN projects p ON p.id = i.project_id AND p.archived = 0
  WHERE (
    EXISTS (SELECT 1 FROM users u WHERE u.id = ? AND u.global_role = 'admin')
    OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = ?)
    OR EXISTS (
      SELECT 1 FROM project_teams pt
      JOIN team_members tm ON tm.team_id = pt.team_id
      WHERE pt.project_id = p.id AND tm.user_id = ?
    )
  )
`;

export function countAssignedOpen(userId: string): number {
  return count(
    `SELECT COUNT(*) as c
     FROM issues i
     JOIN statuses s ON s.id = i.status_id
     JOIN issue_assignees ia ON ia.issue_id = i.id AND ia.user_id = ?
     ${PROJECT_ACCESS_SQL}
       AND s.category != 'done' AND i.deleted_at IS NULL`,
    [userId, userId, userId, userId],
  );
}

export function countAssignedOverdue(userId: string): number {
  return count(
    `SELECT COUNT(*) as c
     FROM issues i
     JOIN statuses s ON s.id = i.status_id
     JOIN issue_assignees ia ON ia.issue_id = i.id AND ia.user_id = ?
     ${PROJECT_ACCESS_SQL}
       AND i.due_date IS NOT NULL
       AND i.due_date < date('now') AND s.category != 'done' AND i.deleted_at IS NULL`,
    [userId, userId, userId, userId],
  );
}

export function listMyQueue(userId: string) {
  return all<{
    id: string;
    key: string;
    title: string;
    project_id: string;
    due_date: string | null;
    status_name: string;
    bucket: string;
  }>(
    `SELECT i.id, i.key, i.title, i.project_id, i.due_date, s.name as status_name,
            CASE
              WHEN i.due_date IS NOT NULL AND i.due_date < date('now') THEN 'overdue'
              WHEN i.due_date = date('now') THEN 'today'
              WHEN i.due_date IS NOT NULL AND i.due_date <= date('now', '+7 day') THEN 'week'
              WHEN s.category = 'in_progress' THEN 'doing'
              ELSE 'nodate'
            END as bucket
     FROM issues i
     JOIN statuses s ON s.id = i.status_id
     JOIN issue_assignees ia ON ia.issue_id = i.id AND ia.user_id = ?
     ${PROJECT_ACCESS_SQL}
       AND s.category != 'done' AND i.deleted_at IS NULL
     ORDER BY i.due_date IS NULL, i.due_date ASC
     LIMIT 40`,
    [userId, userId, userId, userId],
  );
}

export function listAssignedOpen(
  userId: string,
  limit = 12,
): Array<{
  id: string;
  key: string;
  title: string;
  priority: Priority;
  project_id: string;
  status_name: string;
  due_date: string | null;
}> {
  return all(
    `SELECT i.id, i.key, i.title, i.priority, i.project_id, i.due_date, s.name as status_name
     FROM issues i
     JOIN statuses s ON s.id = i.status_id
     JOIN issue_assignees ia ON ia.issue_id = i.id AND ia.user_id = ?
     ${PROJECT_ACCESS_SQL}
       AND s.category != 'done' AND i.deleted_at IS NULL
     ORDER BY i.updated_at DESC LIMIT ?`,
    [userId, userId, userId, userId, limit],
  );
}

export function listAssignedOverdue(
  userId: string,
  limit = 8,
): Array<{
  id: string;
  key: string;
  title: string;
  project_id: string;
  due_date: string;
}> {
  return all(
    `SELECT i.id, i.key, i.title, i.project_id, i.due_date
     FROM issues i
     JOIN statuses s ON s.id = i.status_id
     JOIN issue_assignees ia ON ia.issue_id = i.id AND ia.user_id = ?
     ${PROJECT_ACCESS_SQL}
       AND i.due_date IS NOT NULL
       AND i.due_date < date('now') AND s.category != 'done' AND i.deleted_at IS NULL
     ORDER BY i.due_date ASC LIMIT ?`,
    [userId, userId, userId, userId, limit],
  );
}

export function listRecentIssuesForUser(
  user: SessionUser,
  limit = 10,
): Array<{
  id: string;
  key: string;
  title: string;
  project_id: string;
  updated_at: string;
}> {
  const ids = listProjectsForUser(user).map((p) => p.id);
  if (!ids.length) return [];
  return all(
    `SELECT i.id, i.key, i.title, i.project_id, i.updated_at
     FROM issues i
     WHERE i.deleted_at IS NULL AND i.project_id IN (${ids.map(() => "?").join(",")})
     ORDER BY i.updated_at DESC LIMIT ?`,
    [...ids, limit],
  );
}

export function countProjectIssues(projectId: string): number {
  return count(
    `SELECT COUNT(*) as c FROM issues WHERE project_id = ? AND deleted_at IS NULL`,
    [projectId],
  );
}

export function countSprintProgress(sprintId: string) {
  const total = count(
    `SELECT COUNT(*) as c FROM issues WHERE sprint_id = ? AND deleted_at IS NULL`,
    [sprintId],
  );
  const done = count(
    `SELECT COUNT(*) as c
     FROM issues i JOIN statuses s ON s.id = i.status_id
     WHERE i.sprint_id = ? AND i.deleted_at IS NULL AND s.category = 'done'`,
    [sprintId],
  );
  return { total, done };
}

export function issuesByStatus(projectId: string) {
  return all<{ name: string; c: number }>(
    `SELECT s.name, COUNT(i.id) as c
     FROM statuses s
     LEFT JOIN issues i ON i.status_id = s.id AND i.deleted_at IS NULL
     WHERE s.project_id = ?
     GROUP BY s.id
     ORDER BY s.position`,
    [projectId],
  );
}

export function createdVsDone(projectId: string, days = 14) {
  const since = new Date(Date.now() - (days - 1) * 86400_000).toISOString().slice(0, 10);
  const createdRows = all<{ day: string; c: number }>(
    `SELECT substr(created_at, 1, 10) as day, COUNT(*) as c
     FROM issues
     WHERE project_id = ? AND deleted_at IS NULL AND substr(created_at, 1, 10) >= ?
     GROUP BY substr(created_at, 1, 10)`,
    [projectId, since],
  );
  const doneStatuses = new Set(
    all<{ id: string }>(
      `SELECT id FROM statuses WHERE project_id = ? AND category = 'done'`,
      [projectId],
    ).map((s) => s.id),
  );
  const doneByDay = new Map<string, Set<string>>();
  const moves = all<{
    issue_id: string | null;
    action: string;
    payload_json: string | null;
    day: string;
  }>(
    `SELECT a.issue_id, a.action, a.payload_json, substr(a.created_at, 1, 10) as day
     FROM activity_events a
     JOIN issues i ON i.id = a.issue_id
     WHERE a.project_id = ? AND i.deleted_at IS NULL
       AND a.action IN ('issue.moved', 'issue.updated')
       AND substr(a.created_at, 1, 10) >= ?`,
    [projectId, since],
  );
  for (const m of moves) {
    if (!m.issue_id || !m.payload_json) continue;
    try {
      const p = JSON.parse(m.payload_json) as Record<string, unknown>;
      const toId =
        m.action === "issue.moved"
          ? String(p.to || p.statusId || "")
          : String(((p.changes as Record<string, unknown> | undefined)?.status_id) || "");
      if (toId && doneStatuses.has(toId)) {
        if (!doneByDay.has(m.day)) doneByDay.set(m.day, new Set());
        doneByDay.get(m.day)!.add(m.issue_id);
      }
    } catch {
      // ignore
    }
  }
  const createdMap = new Map(createdRows.map((r) => [r.day, Number(r.c)]));
  const allDays = new Set<string>([...createdMap.keys(), ...doneByDay.keys()]);
  return [...allDays]
    .sort((a, b) => b.localeCompare(a))
    .slice(0, days)
    .map((day) => ({
      day,
      created: createdMap.get(day) ?? 0,
      done: doneByDay.get(day)?.size ?? 0,
    }));
}
