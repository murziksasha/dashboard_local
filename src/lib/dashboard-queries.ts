import { all, count } from "./db";
import { listProjectsForUser } from "./projects";
import type { Priority, SessionUser } from "./types";

export function countAssignedOpen(userId: string): number {
  return count(
    `SELECT COUNT(*) as c
     FROM issues i
     JOIN statuses s ON s.id = i.status_id
     JOIN issue_assignees ia ON ia.issue_id = i.id AND ia.user_id = ?
     WHERE s.category != 'done' AND i.deleted_at IS NULL`,
    [userId],
  );
}

export function countAssignedOverdue(userId: string): number {
  return count(
    `SELECT COUNT(*) as c
     FROM issues i
     JOIN statuses s ON s.id = i.status_id
     JOIN issue_assignees ia ON ia.issue_id = i.id AND ia.user_id = ?
     WHERE i.due_date IS NOT NULL
       AND i.due_date < date('now') AND s.category != 'done' AND i.deleted_at IS NULL`,
    [userId],
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
     WHERE s.category != 'done' AND i.deleted_at IS NULL
     ORDER BY i.due_date IS NULL, i.due_date ASC
     LIMIT 40`,
    [userId],
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
     WHERE s.category != 'done' AND i.deleted_at IS NULL
     ORDER BY i.updated_at DESC LIMIT ?`,
    [userId, limit],
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
     WHERE i.due_date IS NOT NULL
       AND i.due_date < date('now') AND s.category != 'done' AND i.deleted_at IS NULL
     ORDER BY i.due_date ASC LIMIT ?`,
    [userId, limit],
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
  return all<{ day: string; created: number; done: number }>(
    `SELECT date(created_at) as day,
            COUNT(*) as created,
            SUM(CASE WHEN s.category = 'done' THEN 1 ELSE 0 END) as done
     FROM issues i
     JOIN statuses s ON s.id = i.status_id
     WHERE i.project_id = ? AND i.deleted_at IS NULL
     GROUP BY date(created_at)
     ORDER BY day DESC
     LIMIT ?`,
    [projectId, days],
  );
}
