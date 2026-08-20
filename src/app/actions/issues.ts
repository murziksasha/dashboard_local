"use server";

import fs from "fs";
import path from "path";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { all, get, nowIso, run } from "@/lib/db";
import { createId } from "@/lib/id";
import { addComment, createIssue, moveIssue, updateIssue } from "@/lib/issues";
import { logActivity } from "@/lib/activity";
import { bumpBoardVersion } from "@/lib/projects";
import {
  assertMinRole,
  canComment,
  canEditIssues,
  canManageProject,
} from "@/lib/permissions";
import { parseAssigneeIds } from "@/lib/assignees";
import { loadIssueWorkspace } from "@/lib/issue-workspace";
import { getUploadsDir } from "@/lib/paths";
import type { IssueType, LinkType, Priority } from "@/lib/types";
import { parseDurationToSeconds } from "@/lib/utils";

export async function createIssueAction(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") || "");
  if (!canEditIssues(user, projectId)) throw new Error("FORBIDDEN");

  const title = String(formData.get("title") || "").trim();
  if (!title) return { error: "Заголовок обовʼязковий." };

  const labels = String(formData.get("labels") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const storyPointsRaw = String(formData.get("story_points") || "");
  const estimateRaw = String(formData.get("original_estimate_sec") || "");

  const issue = createIssue({
    projectId,
    type: String(formData.get("type") || "task") as IssueType,
    title,
    description: String(formData.get("description") || "") || undefined,
    statusId: String(formData.get("statusId") || "") || undefined,
    priority: (String(formData.get("priority") || "medium") as Priority) || "medium",
    assigneeIds: parseAssigneeIds(formData),
    reporterId: user.id,
    startDate: String(formData.get("start_date") || "") || null,
    parentId: String(formData.get("parentId") || "") || null,
    epicId: String(formData.get("epicId") || "") || null,
    sprintId: String(formData.get("sprintId") || "") || null,
    storyPoints: storyPointsRaw ? Number(storyPointsRaw) : null,
    originalEstimateSec: estimateRaw ? Number(estimateRaw) : null,
    dueDate: String(formData.get("due_date") || "") || null,
    labels,
    actor: user,
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true, id: issue.id, key: issue.key };
}

export async function updateIssueAction(formData: FormData) {
  const user = await requireUser();
  const issueId = String(formData.get("issueId") || "");
  const issue = get<{ project_id: string }>(
    `SELECT project_id FROM issues WHERE id = ?`,
    [issueId],
  );
  if (!issue) return { error: "Не знайдено." };
  if (!canEditIssues(user, issue.project_id)) throw new Error("FORBIDDEN");

  const labels = formData.has("labels")
    ? String(formData.get("labels") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

  updateIssue(issueId, user, {
    title: formData.has("title")
      ? String(formData.get("title") || "")
      : undefined,
    description: formData.has("description")
      ? String(formData.get("description") || "")
      : undefined,
    statusId: formData.has("statusId")
      ? String(formData.get("statusId") || "")
      : undefined,
    priority: formData.has("priority")
      ? (String(formData.get("priority") || "") as Priority)
      : undefined,
    assigneeIds: formData.has("assigneeIds") || formData.has("assigneeId")
      ? parseAssigneeIds(formData)
      : undefined,
    startDate: formData.has("start_date")
      ? String(formData.get("start_date") || "") || null
      : undefined,
    epicId: formData.has("epicId")
      ? String(formData.get("epicId") || "") || null
      : undefined,
    sprintId: formData.has("sprintId")
      ? String(formData.get("sprintId") || "") || null
      : undefined,
    parentId: formData.has("parentId")
      ? String(formData.get("parentId") || "") || null
      : undefined,
    storyPoints: formData.has("story_points")
      ? Number(formData.get("story_points") || 0) || null
      : undefined,
    originalEstimateSec: formData.has("original_estimate")
      ? parseDurationToSeconds(String(formData.get("original_estimate") || ""))
      : formData.has("original_estimate_sec")
        ? Number(formData.get("original_estimate_sec") || 0) || null
        : undefined,
    remainingEstimateSec: formData.has("remaining_estimate")
      ? parseDurationToSeconds(String(formData.get("remaining_estimate") || ""))
      : formData.has("remaining_estimate_sec")
        ? Number(formData.get("remaining_estimate_sec") || 0) || null
        : undefined,
    dueDate: formData.has("due_date")
      ? String(formData.get("due_date") || "") || null
      : undefined,
    type: formData.has("type")
      ? (String(formData.get("type") || "") as IssueType)
      : undefined,
    labels,
  });

  // custom fields
  const customFields = all<{ id: string }>(
    `SELECT id FROM custom_field_defs WHERE project_id = ?`,
    [issue.project_id],
  );
  for (const field of customFields) {
    const key = `cf_${field.id}`;
    if (formData.has(key)) {
      const value = String(formData.get(key) || "");
      run(
        `INSERT INTO custom_field_values (field_id, issue_id, value) VALUES (?, ?, ?)
         ON CONFLICT(field_id, issue_id) DO UPDATE SET value = excluded.value`,
        [field.id, issueId, value],
      );
    }
  }

  revalidatePath(`/projects/${issue.project_id}`);
  revalidatePath(`/projects/${issue.project_id}/issues/${issueId}`);
  return { ok: true };
}

export async function moveIssueAction(input: {
  issueId: string;
  statusId: string;
  beforeId?: string | null;
  afterId?: string | null;
}) {
  const user = await requireUser();
  const issue = get<{ project_id: string }>(
    `SELECT project_id FROM issues WHERE id = ?`,
    [input.issueId],
  );
  if (!issue) throw new Error("NOT_FOUND");
  if (!canEditIssues(user, issue.project_id)) throw new Error("FORBIDDEN");
  try {
    moveIssue({ ...input, actor: user });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Перехід заборонено" };
  }
  revalidatePath(`/projects/${issue.project_id}`);
  return { ok: true };
}

export async function addCommentAction(formData: FormData) {
  const user = await requireUser();
  const issueId = String(formData.get("issueId") || "");
  const body = String(formData.get("body") || "").trim();
  const issue = get<{ project_id: string }>(
    `SELECT project_id FROM issues WHERE id = ?`,
    [issueId],
  );
  if (!issue) return { error: "Не знайдено." };
  if (!canComment(user, issue.project_id)) throw new Error("FORBIDDEN");
  if (!body) return { error: "Порожній коментар." };
  const created = addComment({ issueId, author: user, body });
  revalidatePath(`/projects/${issue.project_id}/issues/${issueId}`);
  return {
    ok: true,
    comment: {
      ...created,
      name: user.name,
    },
  };
}

export async function loadIssueWorkspaceAction(projectId: string, issueId: string) {
  const user = await requireUser();
  const data = loadIssueWorkspace(user, projectId, issueId);
  if (!data) return { error: "Не знайдено." as const };
  return { ok: true as const, data };
}

export async function toggleWatcherAction(issueId: string) {
  const user = await requireUser();
  const issue = get<{ project_id: string }>(
    `SELECT project_id FROM issues WHERE id = ?`,
    [issueId],
  );
  if (!issue) return { error: "Не знайдено." };
  assertMinRole(user, issue.project_id, "viewer");
  const existing = get(
    `SELECT user_id FROM watchers WHERE issue_id = ? AND user_id = ?`,
    [issueId, user.id],
  );
  if (existing) {
    run(`DELETE FROM watchers WHERE issue_id = ? AND user_id = ?`, [
      issueId,
      user.id,
    ]);
  } else {
    run(`INSERT INTO watchers (issue_id, user_id) VALUES (?, ?)`, [
      issueId,
      user.id,
    ]);
  }
  revalidatePath(`/projects/${issue.project_id}/issues/${issueId}`);
  return { ok: true, watching: !existing };
}

export async function addIssueLinkAction(formData: FormData) {
  const user = await requireUser();
  const fromId = String(formData.get("fromIssueId") || "");
  const toKey = String(formData.get("toKey") || "").trim().toUpperCase();
  const rawType = String(formData.get("linkType") || "relates");
  const from = get<{ id: string; project_id: string; key: string }>(
    `SELECT id, project_id, key FROM issues WHERE id = ?`,
    [fromId],
  );
  if (!from) return { error: "Не знайдено." };
  if (!canEditIssues(user, from.project_id)) throw new Error("FORBIDDEN");
  const to = get<{ id: string; project_id: string; key: string; title: string }>(
    `SELECT id, project_id, key, title FROM issues WHERE key = ? COLLATE NOCASE`,
    [toKey],
  );
  if (!to || to.project_id !== from.project_id) {
    return { error: "Задачу з таким ключем не знайдено в проєкті." };
  }
  if (to.id === from.id) return { error: "Не можна лінкувати задачу саму на себе." };

  // "is_blocked_by" => reverse blocks link (to blocks from)
  let linkType: LinkType = "relates";
  let left = from.id;
  let right = to.id;
  if (rawType === "is_blocked_by") {
    linkType = "blocks";
    left = to.id;
    right = from.id;
  } else if (rawType === "blocks" || rawType === "relates" || rawType === "duplicates") {
    linkType = rawType;
  }

  const linkId = createId("lnk");
  run(
    `INSERT OR IGNORE INTO issue_links (id, from_issue_id, to_issue_id, link_type, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [linkId, left, right, linkType, nowIso()],
  );
  logActivity({
    projectId: from.project_id,
    issueId: from.id,
    actorId: user.id,
    action: "issue.linked",
    payload: { toKey, linkType: rawType },
  });
  revalidatePath(`/projects/${from.project_id}/issues/${from.id}`);
  return {
    ok: true,
    link: {
      id: linkId,
      link_type:
        rawType === "is_blocked_by"
          ? "is blocked by"
          : rawType === "relates"
            ? "relates"
            : rawType,
      other_key: to.key,
      other_id: to.id,
      other_title: to.title,
    },
  };
}

export async function addWorklogAction(formData: FormData) {
  const user = await requireUser();
  const issueId = String(formData.get("issueId") || "");
  let seconds = Number(formData.get("seconds") || 0);
  if (formData.has("duration")) {
    seconds = parseDurationToSeconds(String(formData.get("duration") || "")) || 0;
  }
  const workDate = String(formData.get("work_date") || "").slice(0, 10);
  const note = String(formData.get("note") || "").trim() || null;
  const issue = get<{
    project_id: string;
    remaining_estimate_sec: number | null;
  }>(`SELECT project_id, remaining_estimate_sec FROM issues WHERE id = ?`, [
    issueId,
  ]);
  if (!issue) return { error: "Не знайдено." };
  if (!canEditIssues(user, issue.project_id)) throw new Error("FORBIDDEN");
  if (!seconds || seconds < 60) return { error: "Мінімум 1 хвилина." };

  const worklogId = createId("wl");
  const date = workDate || nowIso().slice(0, 10);
  run(
    `INSERT INTO worklogs (id, issue_id, user_id, seconds, work_date, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [worklogId, issueId, user.id, seconds, date, note, nowIso()],
  );

  if (issue.remaining_estimate_sec != null) {
    run(
      `UPDATE issues SET remaining_estimate_sec = MAX(0, remaining_estimate_sec - ?), updated_at = ? WHERE id = ?`,
      [seconds, nowIso(), issueId],
    );
  }
  logActivity({
    projectId: issue.project_id,
    issueId,
    actorId: user.id,
    action: "worklog.added",
    payload: { seconds },
  });
  revalidatePath(`/projects/${issue.project_id}/issues/${issueId}`);
  return {
    ok: true,
    worklog: {
      id: worklogId,
      seconds,
      work_date: date,
      note,
      name: user.name,
    },
  };
}

export async function uploadAttachmentAction(formData: FormData) {
  const user = await requireUser();
  const issueId = String(formData.get("issueId") || "");
  const file = formData.get("file");
  const issue = get<{ project_id: string }>(
    `SELECT project_id FROM issues WHERE id = ?`,
    [issueId],
  );
  if (!issue) return { error: "Не знайдено." };
  if (!canEditIssues(user, issue.project_id) && !canComment(user, issue.project_id)) {
    throw new Error("FORBIDDEN");
  }
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Оберіть файл." };
  }
  if (file.size > 25 * 1024 * 1024) {
    return { error: "Максимальний розмір файлу — 25 МБ." };
  }

  const dir = path.join(getUploadsDir(), issue.project_id);
  fs.mkdirSync(dir, { recursive: true });
  const id = createId("att");
  const safeName = file.name.replace(/[^\w.\-()\sа-яА-ЯіІїЇєЄґҐ]/g, "_");
  const stored = `${id}_${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(path.join(dir, stored), buffer);

  run(
    `INSERT INTO attachments (id, issue_id, uploader_id, filename, stored_name, mime_type, size_bytes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, issueId, user.id, file.name, stored, file.type || null, file.size, nowIso()],
  );
  logActivity({
    projectId: issue.project_id,
    issueId,
    actorId: user.id,
    action: "attachment.added",
    payload: { filename: file.name },
  });
  revalidatePath(`/projects/${issue.project_id}/issues/${issueId}`);
  return {
    ok: true,
    attachment: {
      id,
      filename: file.name,
      size_bytes: file.size,
      created_at: nowIso(),
      mime_type: file.type || null,
    },
  };
}

export async function assignToSprintAction(
  issueId: string,
  sprintId: string | null,
) {
  const user = await requireUser();
  const issue = get<{ project_id: string }>(
    `SELECT project_id FROM issues WHERE id = ?`,
    [issueId],
  );
  if (!issue) throw new Error("NOT_FOUND");
  if (!canEditIssues(user, issue.project_id)) throw new Error("FORBIDDEN");
  updateIssue(issueId, user, { sprintId });
  revalidatePath(`/projects/${issue.project_id}/backlog`);
  return { ok: true };
}

export async function reorderBacklogAction(issueIds: string[]) {
  const user = await requireUser();
  if (!issueIds.length) return { ok: true };
  const first = get<{ project_id: string }>(
    `SELECT project_id FROM issues WHERE id = ?`,
    [issueIds[0]],
  );
  if (!first) throw new Error("NOT_FOUND");
  if (!canEditIssues(user, first.project_id)) throw new Error("FORBIDDEN");
  let rank = "a";
  for (const id of issueIds) {
    run(`UPDATE issues SET rank = ?, updated_at = ? WHERE id = ?`, [
      rank,
      nowIso(),
      id,
    ]);
    rank += "a";
  }
  bumpBoardVersion(first.project_id);
  revalidatePath(`/projects/${first.project_id}/backlog`);
  return { ok: true };
}

export async function updateCommentAction(formData: FormData) {
  const user = await requireUser();
  const commentId = String(formData.get("commentId") || "");
  const body = String(formData.get("body") || "").trim();
  const row = get<{
    id: string;
    author_id: string;
    issue_id: string;
    project_id: string;
  }>(
    `SELECT c.id, c.author_id, c.issue_id, i.project_id
     FROM comments c JOIN issues i ON i.id = c.issue_id WHERE c.id = ?`,
    [commentId],
  );
  if (!row) return { error: "Не знайдено." };
  if (row.author_id !== user.id && user.global_role !== "admin") {
    throw new Error("FORBIDDEN");
  }
  if (!body) return { error: "Порожній коментар." };
  run(`UPDATE comments SET body = ?, updated_at = ? WHERE id = ?`, [
    body,
    nowIso(),
    commentId,
  ]);
  logActivity({
    projectId: row.project_id,
    issueId: row.issue_id,
    actorId: user.id,
    action: "comment.updated",
    payload: { commentId },
  });
  revalidatePath(`/projects/${row.project_id}/issues/${row.issue_id}`);
  return { ok: true };
}

export async function deleteCommentAction(commentId: string) {
  const user = await requireUser();
  const row = get<{
    id: string;
    author_id: string;
    issue_id: string;
    project_id: string;
  }>(
    `SELECT c.id, c.author_id, c.issue_id, i.project_id
     FROM comments c JOIN issues i ON i.id = c.issue_id WHERE c.id = ?`,
    [commentId],
  );
  if (!row) return { error: "Не знайдено." };
  if (row.author_id !== user.id && user.global_role !== "admin") {
    throw new Error("FORBIDDEN");
  }
  run(`DELETE FROM comments WHERE id = ?`, [commentId]);
  logActivity({
    projectId: row.project_id,
    issueId: row.issue_id,
    actorId: user.id,
    action: "comment.deleted",
    payload: { commentId },
  });
  revalidatePath(`/projects/${row.project_id}/issues/${row.issue_id}`);
  return { ok: true };
}

export async function deleteAttachmentAction(attachmentId: string) {
  const user = await requireUser();
  const row = get<{
    id: string;
    issue_id: string;
    project_id: string;
    stored_name: string;
    uploader_id: string;
  }>(
    `SELECT a.id, a.issue_id, a.stored_name, a.uploader_id, i.project_id
     FROM attachments a JOIN issues i ON i.id = a.issue_id WHERE a.id = ?`,
    [attachmentId],
  );
  if (!row) return { error: "Не знайдено." };
  if (!canEditIssues(user, row.project_id) && row.uploader_id !== user.id) {
    throw new Error("FORBIDDEN");
  }
  const filePath = path.join(getUploadsDir(), row.project_id, row.stored_name);
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // ignore fs errors
  }
  run(`DELETE FROM attachments WHERE id = ?`, [attachmentId]);
  logActivity({
    projectId: row.project_id,
    issueId: row.issue_id,
    actorId: user.id,
    action: "attachment.deleted",
    payload: { attachmentId },
  });
  revalidatePath(`/projects/${row.project_id}/issues/${row.issue_id}`);
  return { ok: true };
}

export async function deleteIssueLinkAction(linkId: string) {
  const user = await requireUser();
  const row = get<{
    id: string;
    from_issue_id: string;
    project_id: string;
  }>(
    `SELECT l.id, l.from_issue_id, i.project_id
     FROM issue_links l JOIN issues i ON i.id = l.from_issue_id WHERE l.id = ?`,
    [linkId],
  );
  if (!row) return { error: "Не знайдено." };
  if (!canEditIssues(user, row.project_id)) throw new Error("FORBIDDEN");
  run(`DELETE FROM issue_links WHERE id = ?`, [linkId]);
  logActivity({
    projectId: row.project_id,
    issueId: row.from_issue_id,
    actorId: user.id,
    action: "issue.unlinked",
    payload: { linkId },
  });
  revalidatePath(`/projects/${row.project_id}/issues/${row.from_issue_id}`);
  return { ok: true };
}

export async function deleteIssueAction(issueId: string) {
  const user = await requireUser();
  const issue = get<{ id: string; project_id: string; key: string }>(
    `SELECT id, project_id, key FROM issues WHERE id = ?`,
    [issueId],
  );
  if (!issue) return { error: "Не знайдено." };
  if (!canEditIssues(user, issue.project_id)) throw new Error("FORBIDDEN");
  run(`UPDATE issues SET deleted_at = ?, updated_at = ? WHERE id = ?`, [
    nowIso(),
    nowIso(),
    issueId,
  ]);
  logActivity({
    projectId: issue.project_id,
    actorId: user.id,
    action: "issue.deleted",
    payload: { key: issue.key, issueId },
  });
  bumpBoardVersion(issue.project_id);
  try {
    const { removeIssueFts } = await import("@/lib/search");
    removeIssueFts(issueId);
  } catch {
    // ignore
  }
  try {
    const { snapshotProjectSprints } = await import("@/lib/reports");
    snapshotProjectSprints(issue.project_id);
  } catch {
    // ignore
  }
  revalidatePath(`/projects/${issue.project_id}`);
  revalidatePath(`/projects/${issue.project_id}/trash`);
  return { ok: true, projectId: issue.project_id };
}

export async function restoreIssueAction(issueId: string) {
  const user = await requireUser();
  const issue = get<{ id: string; project_id: string }>(
    `SELECT id, project_id FROM issues WHERE id = ?`,
    [issueId],
  );
  if (!issue) return { error: "Не знайдено." };
  if (!canManageProject(user, issue.project_id)) throw new Error("FORBIDDEN");
  run(`UPDATE issues SET deleted_at = NULL, updated_at = ? WHERE id = ?`, [
    nowIso(),
    issueId,
  ]);
  bumpBoardVersion(issue.project_id);
  try {
    const { upsertIssueFts } = await import("@/lib/search");
    upsertIssueFts(issueId);
  } catch {
    // ignore
  }
  try {
    const { snapshotProjectSprints } = await import("@/lib/reports");
    snapshotProjectSprints(issue.project_id);
  } catch {
    // ignore
  }
  revalidatePath(`/projects/${issue.project_id}`);
  revalidatePath(`/projects/${issue.project_id}/trash`);
  return { ok: true };
}

export async function purgeIssueAction(issueId: string) {
  const user = await requireUser();
  const issue = get<{ id: string; project_id: string }>(
    `SELECT id, project_id FROM issues WHERE id = ? AND deleted_at IS NOT NULL`,
    [issueId],
  );
  if (!issue) return { error: "Не знайдено." };
  if (!canManageProject(user, issue.project_id)) throw new Error("FORBIDDEN");
  const { hardDeleteIssue } = await import("@/lib/purge");
  hardDeleteIssue(issueId, issue.project_id);
  try {
    const { snapshotProjectSprints } = await import("@/lib/reports");
    snapshotProjectSprints(issue.project_id);
  } catch {
    // ignore
  }
  revalidatePath(`/projects/${issue.project_id}`);
  revalidatePath(`/projects/${issue.project_id}/trash`);
  return { ok: true };
}

export async function bulkUpdateIssuesAction(input: {
  issueIds: string[];
  statusId?: string;
  assigneeId?: string | null;
  assigneeIds?: string[];
}) {
  const user = await requireUser();
  if (!input.issueIds.length) return { ok: true };
  const first = get<{ project_id: string }>(
    `SELECT project_id FROM issues WHERE id = ?`,
    [input.issueIds[0]],
  );
  if (!first) throw new Error("NOT_FOUND");
  if (!canEditIssues(user, first.project_id)) throw new Error("FORBIDDEN");

  for (const id of input.issueIds) {
    const patch: Parameters<typeof updateIssue>[2] = {};
    if (input.statusId) patch.statusId = input.statusId;
    if (input.assigneeIds) patch.assigneeIds = input.assigneeIds;
    else if (input.assigneeId !== undefined) {
      patch.assigneeIds = input.assigneeId ? [input.assigneeId] : [];
    }
    if (Object.keys(patch).length) updateIssue(id, user, patch);
  }
  revalidatePath(`/projects/${first.project_id}`);
  revalidatePath(`/projects/${first.project_id}/list`);
  return { ok: true };
}

export async function createSubtaskAction(formData: FormData) {
  const user = await requireUser();
  const parentId = String(formData.get("parentId") || "");
  const title = String(formData.get("title") || "").trim();
  const parent = get<{
    id: string;
    project_id: string;
    epic_id: string | null;
    sprint_id: string | null;
  }>(`SELECT id, project_id, epic_id, sprint_id FROM issues WHERE id = ?`, [
    parentId,
  ]);
  if (!parent) return { error: "Батьківську задачу не знайдено." };
  if (!canEditIssues(user, parent.project_id)) throw new Error("FORBIDDEN");
  if (!title) return { error: "Заголовок обовʼязковий." };
  const issue = createIssue({
    projectId: parent.project_id,
    type: "subtask",
    title,
    parentId: parent.id,
    epicId: parent.epic_id,
    sprintId: parent.sprint_id,
    reporterId: user.id,
    actor: user,
  });
  revalidatePath(`/projects/${parent.project_id}/issues/${parentId}`);
  return {
    ok: true,
    id: issue.id,
    key: issue.key,
    title: issue.title,
    status_name: issue.status_name || "To Do",
  };
}
