import { all, nowIso, run } from "./db";
import { createId } from "./id";
import { createIssue } from "./issues";
import { log } from "./logger";
import type { IssueType, Priority, SessionUser } from "./types";

export type RecurringIssue = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  type: IssueType;
  priority: Priority;
  frequency: "daily" | "weekly" | "monthly";
  next_run_at: string;
  enabled: number;
  created_by: string;
  created_at: string;
};

function addFrequency(iso: string, freq: RecurringIssue["frequency"]): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return new Date(Date.now() + 86400000).toISOString();
  if (freq === "daily") d.setDate(d.getDate() + 1);
  else if (freq === "weekly") d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

export function listRecurring(projectId: string): RecurringIssue[] {
  return all<RecurringIssue>(
    `SELECT * FROM recurring_issues WHERE project_id = ? ORDER BY next_run_at`,
    [projectId],
  );
}

export function createRecurring(params: {
  projectId: string;
  title: string;
  description?: string | null;
  type?: IssueType;
  priority?: Priority;
  frequency: RecurringIssue["frequency"];
  createdBy: string;
}): RecurringIssue {
  const id = createId("rec");
  const ts = nowIso();
  run(
    `INSERT INTO recurring_issues
      (id, project_id, title, description, type, priority, frequency, next_run_at, enabled, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [
      id,
      params.projectId,
      params.title.trim(),
      params.description ?? null,
      params.type || "task",
      params.priority || "medium",
      params.frequency,
      ts,
      params.createdBy,
      ts,
    ],
  );
  return all<RecurringIssue>(`SELECT * FROM recurring_issues WHERE id = ?`, [id])[0]!;
}

export function deleteRecurring(id: string) {
  run(`DELETE FROM recurring_issues WHERE id = ?`, [id]);
}

export function runRecurringIssues(): number {
  const due = all<RecurringIssue>(
    `SELECT * FROM recurring_issues WHERE enabled = 1 AND next_run_at <= ?`,
    [nowIso()],
  );
  let n = 0;
  for (const row of due) {
    try {
      const actor: SessionUser = {
        id: row.created_by,
        login: "system",
        name: "System",
        email: null,
        global_role: "user",
      };
      const user = all<{ login: string; name: string; email: string | null; global_role: "admin" | "user" }>(
        `SELECT login, name, email, global_role FROM users WHERE id = ?`,
        [row.created_by],
      )[0];
      if (user) {
        actor.login = user.login;
        actor.name = user.name;
        actor.email = user.email;
        actor.global_role = user.global_role;
      }
      createIssue({
        projectId: row.project_id,
        type: row.type,
        title: row.title,
        description: row.description || undefined,
        priority: row.priority,
        reporterId: row.created_by,
        actor,
      });
      run(`UPDATE recurring_issues SET next_run_at = ? WHERE id = ?`, [
        addFrequency(nowIso(), row.frequency),
        row.id,
      ]);
      n++;
    } catch (e) {
      log.caught("recurring.create_failed", e);
      run(`UPDATE recurring_issues SET next_run_at = ? WHERE id = ?`, [
        addFrequency(nowIso(), row.frequency),
        row.id,
      ]);
    }
  }
  return n;
}
