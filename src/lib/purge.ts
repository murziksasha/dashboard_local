import { all, nowIso, run } from "./db";
import { removeIssueFts } from "./search";
import { deleteStoredFilesForIssue } from "./uploads";
import { bumpBoardVersion } from "./projects";

export function hardDeleteIssue(issueId: string, projectId?: string) {
  const pid =
    projectId ||
    all<{ project_id: string }>(`SELECT project_id FROM issues WHERE id = ?`, [issueId])[0]
      ?.project_id;
  deleteStoredFilesForIssue(issueId);
  run(`UPDATE issues SET parent_id = NULL WHERE parent_id = ?`, [issueId]);
  run(`UPDATE issues SET epic_id = NULL WHERE epic_id = ?`, [issueId]);
  run(`DELETE FROM issues WHERE id = ?`, [issueId]);
  try {
    removeIssueFts(issueId);
  } catch {
    // ignore
  }
  if (pid) bumpBoardVersion(pid);
}

export function purgeExpiredDeletedIssues() {
  const rows = all<{ id: string; project_id: string }>(
    `SELECT id, project_id FROM issues
     WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', '-30 day')`,
  );
  for (const row of rows) hardDeleteIssue(row.id, row.project_id);
  return rows.length;
}

export function softDeleteStamp() {
  return nowIso();
}
