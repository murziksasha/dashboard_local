import { notFound } from "next/navigation";
import { listIssues, listBoardIssues, listEpics, type BoardIssueRow, type IssueRow } from "./issues";
import {
  assertProjectAccess,
  canEditIssues,
  getProjectRole,
} from "./permissions";
import {
  getProjectById,
  listProjectAssignableUsers,
  listProjectMembers,
  listProjectSprints,
  listStatuses,
} from "./projects";
import type { Project, ProjectRole, SessionUser, Status } from "./types";

export type ProjectShell = {
  project: Project;
  role: ProjectRole;
  statuses: Status[];
  canEdit: boolean;
};

export function loadProjectShell(user: SessionUser, projectId: string): ProjectShell {
  const project = getProjectById(projectId);
  if (!project || project.archived) notFound();
  assertProjectAccess(user, projectId);
  const role = getProjectRole(user, projectId)!;
  return {
    project,
    role,
    statuses: listStatuses(projectId),
    canEdit: canEditIssues(user, projectId),
  };
}

export function loadProjectPeople(projectId: string) {
  return {
    users: listProjectAssignableUsers(projectId),
    members: listProjectMembers(projectId),
  };
}

/** Compatibility wrapper for pages that still want the full bundle. */
export function loadProjectContext(user: SessionUser, projectId: string) {
  const shell = loadProjectShell(user, projectId);
  const people = loadProjectPeople(projectId);
  const issues = listIssues(projectId);
  const sprints = listProjectSprints(projectId);
  const epics = listEpics(projectId);
  return {
    ...shell,
    ...people,
    issues,
    sprints,
    epics,
  };
}

export type { BoardIssueRow, IssueRow };
