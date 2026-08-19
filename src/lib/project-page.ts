import { notFound } from "next/navigation";
import { listActiveUsers } from "./auth";
import { all } from "./db";
import { listIssues } from "./issues";
import {
  assertProjectAccess,
  canEditIssues,
  getProjectRole,
} from "./permissions";
import { getProjectById, listStatuses } from "./projects";
import type { SessionUser } from "./types";

export function loadProjectContext(user: SessionUser, projectId: string) {
  const project = getProjectById(projectId);
  if (!project || project.archived) notFound();
  assertProjectAccess(user, projectId);
  const role = getProjectRole(user, projectId)!;
  const statuses = listStatuses(projectId);
  const issues = listIssues(projectId);
  const users = listActiveUsers();
  const sprints = all<{
    id: string;
    name: string;
    status: string;
    goal: string | null;
    start_date: string | null;
    end_date: string | null;
  }>(
    `SELECT id, name, status, goal, start_date, end_date FROM sprints WHERE project_id = ? ORDER BY created_at DESC`,
    [projectId],
  );
  const epics = issues.filter((i) => i.type === "epic");
  const members = all<{ id: string; name: string; role: string }>(
    `SELECT u.id, u.name, pm.role
     FROM project_members pm
     JOIN users u ON u.id = pm.user_id
     WHERE pm.project_id = ?
     ORDER BY u.name`,
    [projectId],
  );
  return {
    project,
    role,
    statuses,
    issues,
    users,
    sprints,
    epics,
    members,
    canEdit: canEditIssues(user, projectId),
  };
}
