"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/lib/auth";
import { all, get, nowIso, run } from "@/lib/db";
import { createId } from "@/lib/id";
import {
  assertMinRole,
  canManageProject,
} from "@/lib/permissions";
import { bumpBoardVersion, createProject, getProjectById } from "@/lib/projects";
import type { ProjectRole, StatusCategory } from "@/lib/types";

export async function createProjectAction(formData: FormData) {
  const user = await requireUser();
  if (user.global_role !== "admin") {
    // allow any logged-in user to create? Plan says admin/lead - only admin creates orgs typically.
    // We'll allow admin only for project creation at workspace level; leads manage existing.
    await requireAdmin();
  }
  const key = String(formData.get("key") || "").trim().toUpperCase();
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  if (!/^[A-Z][A-Z0-9]{1,9}$/.test(key)) {
    return { error: "Ключ: 2–10 символів, латиниця/цифри, починається з літери." };
  }
  if (!name) return { error: "Назва обовʼязкова." };
  if (get(`SELECT id FROM projects WHERE key = ? COLLATE NOCASE`, [key])) {
    return { error: "Проєкт з таким ключем уже існує." };
  }
  const project = createProject({
    key,
    name,
    description,
    leadId: user.id,
    actor: user,
  });
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  return { id: project.id };
}

export async function archiveProjectAction(projectId: string) {
  const user = await requireUser();
  assertMinRole(user, projectId, "lead");
  run(`UPDATE projects SET archived = 1, updated_at = ? WHERE id = ?`, [
    nowIso(),
    projectId,
  ]);
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/settings`);
}

export async function unarchiveProjectAction(projectId: string) {
  const user = await requireUser();
  assertMinRole(user, projectId, "lead");
  run(`UPDATE projects SET archived = 0, updated_at = ? WHERE id = ?`, [
    nowIso(),
    projectId,
  ]);
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
}

export async function addProjectMemberAction(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") || "");
  const userId = String(formData.get("userId") || "");
  const role = String(formData.get("role") || "member") as ProjectRole;
  assertMinRole(user, projectId, "lead");
  run(
    `INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)
     ON CONFLICT(project_id, user_id) DO UPDATE SET role = excluded.role`,
    [projectId, userId, role],
  );
  revalidatePath(`/projects/${projectId}/settings`);
}

export async function removeProjectMemberAction(
  projectId: string,
  userId: string,
) {
  const user = await requireUser();
  assertMinRole(user, projectId, "lead");
  run(`DELETE FROM project_members WHERE project_id = ? AND user_id = ?`, [
    projectId,
    userId,
  ]);
  revalidatePath(`/projects/${projectId}/settings`);
}

export async function addProjectTeamAction(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") || "");
  const teamId = String(formData.get("teamId") || "");
  const role = String(formData.get("role") || "member") as ProjectRole;
  assertMinRole(user, projectId, "lead");
  run(
    `INSERT INTO project_teams (project_id, team_id, role) VALUES (?, ?, ?)
     ON CONFLICT(project_id, team_id) DO UPDATE SET role = excluded.role`,
    [projectId, teamId, role],
  );
  revalidatePath(`/projects/${projectId}/settings`);
}

export async function addStatusAction(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") || "");
  const name = String(formData.get("name") || "").trim();
  const category = String(formData.get("category") || "todo") as StatusCategory;
  const wipRaw = String(formData.get("wip_limit") || "").trim();
  const wipLimit = wipRaw ? Number(wipRaw) : null;
  assertMinRole(user, projectId, "lead");
  if (!name) throw new Error("Назва статусу обовʼязкова.");
  const maxPos = get<{ p: number }>(
    `SELECT COALESCE(MAX(position), -1) as p FROM statuses WHERE project_id = ?`,
    [projectId],
  )?.p ?? -1;
  run(
    `INSERT INTO statuses (id, project_id, name, category, position, wip_limit)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [createId("st"), projectId, name, category, maxPos + 1, wipLimit],
  );
  bumpBoardVersion(projectId);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/settings`);
}

export async function updateStatusAction(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") || "");
  const statusId = String(formData.get("statusId") || "");
  const name = String(formData.get("name") || "").trim();
  const category = String(formData.get("category") || "todo") as StatusCategory;
  const wipRaw = String(formData.get("wip_limit") || "").trim();
  const wipLimit = wipRaw ? Number(wipRaw) : null;
  assertMinRole(user, projectId, "lead");
  if (!name) throw new Error("Назва статусу обовʼязкова.");
  run(
    `UPDATE statuses SET name = ?, category = ?, wip_limit = ? WHERE id = ? AND project_id = ?`,
    [name, category, wipLimit, statusId, projectId],
  );
  bumpBoardVersion(projectId);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/settings`);
}

export async function deleteStatusAction(projectId: string, statusId: string) {
  const user = await requireUser();
  assertMinRole(user, projectId, "lead");
  const count = get<{ c: number }>(
    `SELECT COUNT(*) as c FROM issues WHERE status_id = ?`,
    [statusId],
  )?.c ?? 0;
  if (count > 0) {
    throw new Error("Неможливо видалити статус: є задачі в цій колонці.");
  }
  const total = get<{ c: number }>(
    `SELECT COUNT(*) as c FROM statuses WHERE project_id = ?`,
    [projectId],
  )?.c ?? 0;
  if (total <= 1) throw new Error("Має залишитись хоча б один статус.");
  run(`DELETE FROM statuses WHERE id = ? AND project_id = ?`, [
    statusId,
    projectId,
  ]);
  bumpBoardVersion(projectId);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/settings`);
}

export async function reorderStatusesAction(
  projectId: string,
  orderedIds: string[],
) {
  const user = await requireUser();
  assertMinRole(user, projectId, "lead");
  orderedIds.forEach((id, position) => {
    run(`UPDATE statuses SET position = ? WHERE id = ? AND project_id = ?`, [
      position,
      id,
      projectId,
    ]);
  });
  bumpBoardVersion(projectId);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/settings`);
}

export async function removeProjectTeamAction(
  projectId: string,
  teamId: string,
) {
  const user = await requireUser();
  assertMinRole(user, projectId, "lead");
  run(`DELETE FROM project_teams WHERE project_id = ? AND team_id = ?`, [
    projectId,
    teamId,
  ]);
  revalidatePath(`/projects/${projectId}/settings`);
}

export async function createSprintAction(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") || "");
  assertMinRole(user, projectId, "lead");
  const name = String(formData.get("name") || "").trim();
  const goal = String(formData.get("goal") || "").trim() || null;
  const startDate = String(formData.get("start_date") || "") || null;
  const endDate = String(formData.get("end_date") || "") || null;
  if (!name) throw new Error("Назва спринту обовʼязкова.");
  run(
    `INSERT INTO sprints (id, project_id, name, goal, start_date, end_date, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'future', ?)`,
    [createId("spr"), projectId, name, goal, startDate, endDate, nowIso()],
  );
  revalidatePath(`/projects/${projectId}/backlog`);
}

export async function startSprintAction(projectId: string, sprintId: string) {
  const user = await requireUser();
  assertMinRole(user, projectId, "lead");
  const active = get(
    `SELECT id FROM sprints WHERE project_id = ? AND status = 'active'`,
    [projectId],
  );
  if (active) throw new Error("Уже є активний спринт.");
  run(`UPDATE sprints SET status = 'active' WHERE id = ? AND project_id = ?`, [
    sprintId,
    projectId,
  ]);
  const { recordSprintCommit } = await import("@/lib/reports");
  recordSprintCommit(sprintId);
  bumpBoardVersion(projectId);
  revalidatePath(`/projects/${projectId}`);
}

export async function completeSprintAction(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") || "");
  const sprintId = String(formData.get("sprintId") || "");
  const moveTo = String(formData.get("moveTo") || "backlog");
  assertMinRole(user, projectId, "lead");

  const { recordSprintComplete } = await import("@/lib/reports");
  recordSprintComplete(sprintId);

  const incomplete = all<{ id: string }>(
    `SELECT i.id FROM issues i
     JOIN statuses s ON s.id = i.status_id
     WHERE i.sprint_id = ? AND s.category != 'done' AND i.deleted_at IS NULL`,
    [sprintId],
  );

  if (moveTo === "backlog") {
    for (const issue of incomplete) {
      run(`UPDATE issues SET sprint_id = NULL, updated_at = ? WHERE id = ?`, [
        nowIso(),
        issue.id,
      ]);
    }
  } else {
    for (const issue of incomplete) {
      run(`UPDATE issues SET sprint_id = ?, updated_at = ? WHERE id = ?`, [
        moveTo,
        nowIso(),
        issue.id,
      ]);
    }
  }

  run(`UPDATE sprints SET status = 'closed' WHERE id = ?`, [sprintId]);
  bumpBoardVersion(projectId);
  revalidatePath(`/projects/${projectId}`);
}

export async function createCustomFieldAction(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") || "");
  if (!canManageProject(user, projectId)) throw new Error("FORBIDDEN");
  const name = String(formData.get("name") || "").trim();
  const fieldType = String(formData.get("field_type") || "text");
  const options = String(formData.get("options") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!name) throw new Error("Назва поля обовʼязкова.");
  const pos =
    get<{ p: number }>(
      `SELECT COALESCE(MAX(position), -1) as p FROM custom_field_defs WHERE project_id = ?`,
      [projectId],
    )?.p ?? -1;
  run(
    `INSERT INTO custom_field_defs (id, project_id, name, field_type, options_json, required, position)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
    [
      createId("cfd"),
      projectId,
      name,
      fieldType,
      options.length ? JSON.stringify(options) : null,
      pos + 1,
    ],
  );
  revalidatePath(`/projects/${projectId}/settings`);
}

export async function getBoardVersionAction(projectId: string) {
  const user = await requireUser();
  assertMinRole(user, projectId, "viewer");
  const project = getProjectById(projectId);
  return { version: project?.board_version ?? 0 };
}
