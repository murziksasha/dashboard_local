import { get } from "./db";
import type { ProjectRole, SessionUser } from "./types";

const ROLE_RANK: Record<ProjectRole, number> = {
  viewer: 1,
  member: 2,
  lead: 3,
};

export function getProjectRole(
  user: SessionUser,
  projectId: string,
): ProjectRole | null {
  if (user.global_role === "admin") return "lead";

  const direct = get<{ role: ProjectRole }>(
    `SELECT role FROM project_members WHERE project_id = ? AND user_id = ?`,
    [projectId, user.id],
  );
  if (direct) return direct.role;

  const viaTeam = get<{ role: ProjectRole }>(
    `SELECT pt.role
     FROM project_teams pt
     JOIN team_members tm ON tm.team_id = pt.team_id
     WHERE pt.project_id = ? AND tm.user_id = ?
     ORDER BY CASE pt.role WHEN 'lead' THEN 3 WHEN 'member' THEN 2 ELSE 1 END DESC
     LIMIT 1`,
    [projectId, user.id],
  );
  return viaTeam?.role ?? null;
}

export function canAccessProject(user: SessionUser, projectId: string): boolean {
  return getProjectRole(user, projectId) !== null;
}

export function hasMinRole(
  user: SessionUser,
  projectId: string,
  min: ProjectRole,
): boolean {
  const role = getProjectRole(user, projectId);
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export function assertProjectAccess(user: SessionUser, projectId: string) {
  if (!canAccessProject(user, projectId)) throw new Error("FORBIDDEN");
}

export function assertMinRole(
  user: SessionUser,
  projectId: string,
  min: ProjectRole,
) {
  if (!hasMinRole(user, projectId, min)) throw new Error("FORBIDDEN");
}

/** Viewer can comment; member+ can edit issues; lead+ can configure project. */
export function canComment(user: SessionUser, projectId: string) {
  return hasMinRole(user, projectId, "viewer");
}

export function canEditIssues(user: SessionUser, projectId: string) {
  return hasMinRole(user, projectId, "member");
}

export function canManageProject(user: SessionUser, projectId: string) {
  return hasMinRole(user, projectId, "lead");
}
