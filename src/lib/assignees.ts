import { all, get, run } from "./db";
import { notifyUser } from "./notifications";

export type Assignee = { id: string; name: string; login: string; position: number };

export function getIssueAssignees(issueId: string): Assignee[] {
  return all<Assignee>(
    `SELECT u.id, u.name, u.login, ia.position
     FROM issue_assignees ia
     JOIN users u ON u.id = ia.user_id
     WHERE ia.issue_id = ?
     ORDER BY ia.position, u.name`,
    [issueId],
  );
}

export function getAssigneesMap(issueIds: string[]): Record<string, Assignee[]> {
  if (!issueIds.length) return {};
  const rows = all<Assignee & { issue_id: string }>(
    `SELECT ia.issue_id, u.id, u.name, u.login, ia.position
     FROM issue_assignees ia
     JOIN users u ON u.id = ia.user_id
     WHERE ia.issue_id IN (${issueIds.map(() => "?").join(",")})
     ORDER BY ia.position, u.name`,
    issueIds,
  );
  const map: Record<string, Assignee[]> = {};
  for (const row of rows) {
    if (!map[row.issue_id]) map[row.issue_id] = [];
    map[row.issue_id].push({
      id: row.id,
      name: row.name,
      login: row.login,
      position: row.position,
    });
  }
  return map;
}

/** Replace assignees; syncs legacy issues.assignee_id to first assignee. */
export function setIssueAssignees(
  issueId: string,
  userIds: string[],
  opts?: {
    actorId?: string;
    issueKey?: string;
    issueTitle?: string;
    projectId?: string;
    notifyNew?: boolean;
  },
) {
  const unique = [...new Set(userIds.filter(Boolean))];
  const prev = new Set(getIssueAssignees(issueId).map((a) => a.id));

  run(`DELETE FROM issue_assignees WHERE issue_id = ?`, [issueId]);
  unique.forEach((userId, position) => {
    run(
      `INSERT INTO issue_assignees (issue_id, user_id, position) VALUES (?, ?, ?)`,
      [issueId, userId, position],
    );
    run(`INSERT OR IGNORE INTO watchers (issue_id, user_id) VALUES (?, ?)`, [
      issueId,
      userId,
    ]);
  });

  const primary = unique[0] ?? null;
  run(`UPDATE issues SET assignee_id = ? WHERE id = ?`, [primary, issueId]);

  if (opts?.notifyNew && opts.projectId && opts.issueKey) {
    for (const userId of unique) {
      if (prev.has(userId)) continue;
      if (opts.actorId && userId === opts.actorId) continue;
      notifyUser({
        userId,
        type: "assigned",
        title: `Вас призначено на ${opts.issueKey}`,
        body: opts.issueTitle || "",
        link: `/projects/${opts.projectId}/issues/${issueId}`,
      });
    }
  }
}

export function parseAssigneeIds(formData: FormData): string[] {
  const multi = formData.getAll("assigneeIds").map(String).filter(Boolean);
  if (multi.length) return multi;
  const single = String(formData.get("assigneeId") || "");
  return single ? [single] : [];
}

export function issueHasAssignee(issueId: string, userId: string): boolean {
  return !!get(
    `SELECT user_id FROM issue_assignees WHERE issue_id = ? AND user_id = ?`,
    [issueId, userId],
  );
}
