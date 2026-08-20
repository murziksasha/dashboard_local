import { all, getDb, run } from "./db";
import { listProjectsForUser } from "./projects";
import type { SessionUser } from "./types";

function ftsAvailable(): boolean {
  try {
    getDb().exec(`SELECT 1 FROM issues_fts LIMIT 1`);
    return true;
  } catch {
    return false;
  }
}

export function upsertIssueFts(issueId: string) {
  if (!ftsAvailable()) return;
  const row = all<{
    id: string;
    key: string;
    title: string;
    description: string | null;
  }>(
    `SELECT id, key, title, description FROM issues WHERE id = ? AND deleted_at IS NULL`,
    [issueId],
  )[0];
  run(`DELETE FROM issues_fts WHERE issue_id = ?`, [issueId]);
  if (!row) return;
  const labels = all<{ label: string }>(
    `SELECT label FROM issue_labels WHERE issue_id = ?`,
    [issueId],
  )
    .map((r) => r.label)
    .join(" ");
  run(
    `INSERT INTO issues_fts (issue_id, key, title, description, labels) VALUES (?, ?, ?, ?, ?)`,
    [row.id, row.key, row.title, row.description || "", labels],
  );
}

export function removeIssueFts(issueId: string) {
  if (!ftsAvailable()) return;
  try {
    run(`DELETE FROM issues_fts WHERE issue_id = ?`, [issueId]);
  } catch {
    // ignore
  }
}

export function backfillIssueFts() {
  if (!ftsAvailable()) return;
  const rows = all<{ id: string }>(`SELECT id FROM issues WHERE deleted_at IS NULL`);
  for (const row of rows) upsertIssueFts(row.id);
}

export type SearchHit = {
  id: string;
  key: string;
  title: string;
  project_id: string;
  project_key: string;
};

export function searchIssues(user: SessionUser, query: string, limit = 20): SearchHit[] {
  const q = query.trim();
  if (!q) return [];
  const projects = listProjectsForUser(user);
  if (!projects.length) return [];
  const ids = projects.map((p) => p.id);
  const inList = ids.map(() => "?").join(",");

  if (ftsAvailable() && !q.includes('"')) {
    try {
      const ftsQuery = q
        .split(/\s+/)
        .map((w) => `"${w.replace(/"/g, "")}"*`)
        .join(" AND ");
      return all<SearchHit>(
        `SELECT i.id, i.key, i.title, i.project_id, p.key as project_key
         FROM issues_fts f
         JOIN issues i ON i.id = f.issue_id
         JOIN projects p ON p.id = i.project_id
         WHERE f MATCH ? AND i.project_id IN (${inList}) AND i.deleted_at IS NULL
         LIMIT ?`,
        [ftsQuery, ...ids, limit],
      );
    } catch {
      // fall through to LIKE
    }
  }

  const like = `%${q}%`;
  return all<SearchHit>(
    `SELECT i.id, i.key, i.title, i.project_id, p.key as project_key
     FROM issues i JOIN projects p ON p.id = i.project_id
     WHERE i.project_id IN (${inList}) AND i.deleted_at IS NULL
       AND (i.title LIKE ? OR i.key LIKE ? OR i.description LIKE ?)
     ORDER BY i.updated_at DESC LIMIT ?`,
    [...ids, like, like, like, limit],
  );
}


