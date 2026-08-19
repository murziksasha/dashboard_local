import { logActivity } from "./activity";
import { all, get, nowIso, run } from "./db";
import { createId } from "./id";
import type { Project, SessionUser, Status } from "./types";
import { DEFAULT_STATUSES } from "./types";

export function listProjectsForUser(
  user: SessionUser,
  opts?: { includeArchived?: boolean },
): Project[] {
  if (user.global_role === "admin") {
    return all<Project>(
      opts?.includeArchived
        ? `SELECT * FROM projects ORDER BY archived, name`
        : `SELECT * FROM projects WHERE archived = 0 ORDER BY name`,
    );
  }
  const archivedClause = opts?.includeArchived ? "1=1" : "p.archived = 0";
  return all<Project>(
    `SELECT DISTINCT p.*
     FROM projects p
     LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
     LEFT JOIN project_teams pt ON pt.project_id = p.id
     LEFT JOIN team_members tm ON tm.team_id = pt.team_id AND tm.user_id = ?
     WHERE ${archivedClause} AND (pm.user_id IS NOT NULL OR tm.user_id IS NOT NULL)
     ORDER BY p.archived, p.name`,
    [user.id, user.id],
  );
}

export function getProjectById(id: string) {
  return get<Project>(`SELECT * FROM projects WHERE id = ?`, [id]);
}

export function getProjectByKey(key: string) {
  return get<Project>(`SELECT * FROM projects WHERE key = ? COLLATE NOCASE`, [
    key,
  ]);
}

export function bumpBoardVersion(projectId: string) {
  run(
    `UPDATE projects SET board_version = board_version + 1, updated_at = ? WHERE id = ?`,
    [nowIso(), projectId],
  );
}

export function createProject(params: {
  key: string;
  name: string;
  description?: string;
  leadId: string;
  actor: SessionUser;
  memberIds?: string[];
}): Project {
  const id = createId("prj");
  const ts = nowIso();
  const key = params.key.trim().toUpperCase();
  run(
    `INSERT INTO projects (id, key, name, description, lead_id, issue_seq, archived, board_version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, 0, 1, ?, ?)`,
    [id, key, params.name.trim(), params.description ?? null, params.leadId, ts, ts],
  );

  run(
    `INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'lead')`,
    [id, params.leadId],
  );

  for (const [i, s] of DEFAULT_STATUSES.entries()) {
    run(
      `INSERT INTO statuses (id, project_id, name, category, position, wip_limit)
       VALUES (?, ?, ?, ?, ?, NULL)`,
      [createId("st"), id, s.name, s.category, i],
    );
  }

  const members = new Set(params.memberIds ?? []);
  members.delete(params.leadId);
  for (const uid of members) {
    run(
      `INSERT OR IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, 'member')`,
      [id, uid],
    );
  }

  // default personal-ish project widgets for lead skipped — dashboards use dynamic queries

  logActivity({
    projectId: id,
    actorId: params.actor.id,
    action: "project.created",
    payload: { key, name: params.name },
  });

  return getProjectById(id)!;
}

export function listStatuses(projectId: string): Status[] {
  return all<Status>(
    `SELECT * FROM statuses WHERE project_id = ? ORDER BY position, name`,
    [projectId],
  );
}

export function ensureStatus(
  projectId: string,
  name: string,
  category: Status["category"],
  position: number,
) {
  const existing = get<Status>(
    `SELECT * FROM statuses WHERE project_id = ? AND name = ?`,
    [projectId, name],
  );
  if (existing) return existing;
  const id = createId("st");
  run(
    `INSERT INTO statuses (id, project_id, name, category, position, wip_limit) VALUES (?, ?, ?, ?, ?, NULL)`,
    [id, projectId, name, category, position],
  );
  return get<Status>(`SELECT * FROM statuses WHERE id = ?`, [id])!;
}
