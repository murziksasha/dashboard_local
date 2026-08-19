import { logActivity } from "./activity";
import { setIssueAssignees } from "./assignees";
import { all, get, getDb, nowIso, run } from "./db";
import { createId, rankBetween } from "./id";
import { extractMentions, notifyMany } from "./notifications";
import { bumpBoardVersion, getProjectById, listStatuses } from "./projects";
import type {
  Issue,
  IssueFilter,
  IssueType,
  Priority,
  SessionUser,
} from "./types";
import { getProjectRole } from "./permissions";
import { assertTransitionAllowed } from "./workflow";

export type IssueRow = Issue & {
  status_name?: string;
  status_category?: string;
  assignee_name?: string | null;
  assignee_names?: string | null;
  reporter_name?: string | null;
  labels?: string;
};

function nextIssueKey(projectId: string): string {
  const db = getDb();
  db.exec("BEGIN");
  try {
    const project = getProjectById(projectId);
    if (!project) throw new Error("PROJECT_NOT_FOUND");
    const seq = project.issue_seq + 1;
    run(`UPDATE projects SET issue_seq = ?, updated_at = ? WHERE id = ?`, [
      seq,
      nowIso(),
      projectId,
    ]);
    db.exec("COMMIT");
    return `${project.key}-${seq}`;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

function lastRank(projectId: string, statusId: string | null): string | null {
  if (statusId) {
    const row = get<{ rank: string }>(
      `SELECT rank FROM issues WHERE project_id = ? AND status_id = ? ORDER BY rank DESC LIMIT 1`,
      [projectId, statusId],
    );
    return row?.rank ?? null;
  }
  const row = get<{ rank: string }>(
    `SELECT rank FROM issues WHERE project_id = ? AND sprint_id IS NULL ORDER BY rank DESC LIMIT 1`,
    [projectId],
  );
  return row?.rank ?? null;
}

export function createIssue(params: {
  projectId: string;
  type: IssueType;
  title: string;
  description?: string;
  statusId?: string;
  priority?: Priority;
  assigneeId?: string | null;
  assigneeIds?: string[];
  reporterId: string;
  parentId?: string | null;
  epicId?: string | null;
  sprintId?: string | null;
  storyPoints?: number | null;
  originalEstimateSec?: number | null;
  startDate?: string | null;
  dueDate?: string | null;
  labels?: string[];
  actor: SessionUser;
}): Issue {
  const statuses = listStatuses(params.projectId);
  const statusId =
    params.statusId ??
    statuses.find((s) => s.name === "To Do")?.id ??
    statuses[0]?.id;
  if (!statusId) throw new Error("NO_STATUSES");

  const id = createId("iss");
  const key = nextIssueKey(params.projectId);
  const ts = nowIso();
  const rank = rankBetween(lastRank(params.projectId, statusId), null);

  const assigneeIds =
    params.assigneeIds?.length
      ? params.assigneeIds
      : params.assigneeId
        ? [params.assigneeId]
        : [];

  run(
    `INSERT INTO issues (
      id, project_id, key, type, title, description, status_id, priority,
      assignee_id, reporter_id, parent_id, epic_id, sprint_id, story_points,
      original_estimate_sec, remaining_estimate_sec, start_date, due_date, rank, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.projectId,
      key,
      params.type,
      params.title.trim(),
      params.description ?? null,
      statusId,
      params.priority ?? "medium",
      assigneeIds[0] ?? null,
      params.reporterId,
      params.parentId ?? null,
      params.epicId ?? null,
      params.sprintId ?? null,
      params.storyPoints ?? null,
      params.originalEstimateSec ?? null,
      params.originalEstimateSec ?? null,
      params.startDate ?? null,
      params.dueDate ?? null,
      rank,
      ts,
      ts,
    ],
  );

  for (const label of params.labels ?? []) {
    const cleaned = label.trim();
    if (!cleaned) continue;
    run(`INSERT OR IGNORE INTO issue_labels (issue_id, label) VALUES (?, ?)`, [
      id,
      cleaned,
    ]);
  }

  run(`INSERT OR IGNORE INTO watchers (issue_id, user_id) VALUES (?, ?)`, [
    id,
    params.reporterId,
  ]);
  setIssueAssignees(id, assigneeIds, {
    actorId: params.actor.id,
    issueKey: key,
    issueTitle: params.title,
    projectId: params.projectId,
    notifyNew: true,
  });

  logActivity({
    projectId: params.projectId,
    issueId: id,
    actorId: params.actor.id,
    action: "issue.created",
    payload: { key, title: params.title, type: params.type },
  });
  bumpBoardVersion(params.projectId);
  return getIssue(id)!;
}

export function getIssue(id: string): IssueRow | undefined {
  return get<IssueRow>(
    `SELECT i.*, s.name as status_name, s.category as status_category,
            au.name as assignee_name, ru.name as reporter_name
     FROM issues i
     JOIN statuses s ON s.id = i.status_id
     LEFT JOIN users au ON au.id = i.assignee_id
     LEFT JOIN users ru ON ru.id = i.reporter_id
     WHERE i.id = ?`,
    [id],
  );
}

export function getIssueLabels(issueId: string): string[] {
  return all<{ label: string }>(
    `SELECT label FROM issue_labels WHERE issue_id = ? ORDER BY label`,
    [issueId],
  ).map((r) => r.label);
}

export function listIssues(
  projectId: string,
  filter: IssueFilter = {},
): IssueRow[] {
  const where: string[] = ["i.project_id = ?"];
  const params: unknown[] = [projectId];

  if (filter.q) {
    where.push(`(i.title LIKE ? OR i.description LIKE ? OR i.key LIKE ?)`);
    const q = `%${filter.q}%`;
    params.push(q, q, q);
  }
  if (filter.types?.length) {
    where.push(`i.type IN (${filter.types.map(() => "?").join(",")})`);
    params.push(...filter.types);
  }
  if (filter.statusIds?.length) {
    where.push(`i.status_id IN (${filter.statusIds.map(() => "?").join(",")})`);
    params.push(...filter.statusIds);
  }
  if (filter.priorities?.length) {
    where.push(`i.priority IN (${filter.priorities.map(() => "?").join(",")})`);
    params.push(...filter.priorities);
  }
  if (filter.assigneeIds?.length) {
    const parts: string[] = [];
    for (const a of filter.assigneeIds) {
      if (a === "unassigned") {
        parts.push(
          `NOT EXISTS (SELECT 1 FROM issue_assignees ia0 WHERE ia0.issue_id = i.id)`,
        );
      } else {
        parts.push(
          `EXISTS (SELECT 1 FROM issue_assignees ia1 WHERE ia1.issue_id = i.id AND ia1.user_id = ?)`,
        );
        params.push(a);
      }
    }
    where.push(`(${parts.join(" OR ")})`);
  }
  if (filter.sprintId === "backlog") {
    where.push(`i.sprint_id IS NULL`);
  } else if (filter.sprintId && filter.sprintId !== "any") {
    where.push(`i.sprint_id = ?`);
    params.push(filter.sprintId);
  }
  if (filter.epicId) {
    where.push(`i.epic_id = ?`);
    params.push(filter.epicId);
  }
  if (filter.due === "overdue") {
    where.push(`i.due_date IS NOT NULL AND i.due_date < date('now') AND s.category != 'done'`);
  } else if (filter.due === "week") {
    where.push(`i.due_date IS NOT NULL AND i.due_date <= date('now', '+7 day')`);
  } else if (filter.due === "none") {
    where.push(`i.due_date IS NULL`);
  }
  if (filter.labels?.length) {
    where.push(
      `EXISTS (SELECT 1 FROM issue_labels il WHERE il.issue_id = i.id AND il.label IN (${filter.labels.map(() => "?").join(",")}))`,
    );
    params.push(...filter.labels);
  }

  const rows = all<IssueRow>(
    `SELECT i.*, s.name as status_name, s.category as status_category,
            au.name as assignee_name, ru.name as reporter_name,
            (SELECT GROUP_CONCAT(label, ', ') FROM issue_labels il WHERE il.issue_id = i.id) as labels,
            (SELECT GROUP_CONCAT(u.name, ', ') FROM issue_assignees ia
               JOIN users u ON u.id = ia.user_id
               WHERE ia.issue_id = i.id) as assignee_names
     FROM issues i
     JOIN statuses s ON s.id = i.status_id
     LEFT JOIN users au ON au.id = i.assignee_id
     LEFT JOIN users ru ON ru.id = i.reporter_id
     WHERE ${where.join(" AND ")}
     ORDER BY i.rank ASC, i.created_at ASC`,
    params,
  );
  return rows;
}

export function updateIssue(
  issueId: string,
  actor: SessionUser,
  patch: Partial<{
    title: string;
    description: string | null;
    statusId: string;
    priority: Priority;
    assigneeId: string | null;
    assigneeIds: string[];
    parentId: string | null;
    epicId: string | null;
    sprintId: string | null;
    storyPoints: number | null;
    originalEstimateSec: number | null;
    remainingEstimateSec: number | null;
    startDate: string | null;
    dueDate: string | null;
    type: IssueType;
    labels: string[];
  }>,
) {
  const issue = getIssue(issueId);
  if (!issue) throw new Error("NOT_FOUND");

  const fields: string[] = [];
  const params: unknown[] = [];
  const changes: Record<string, unknown> = {};

  const map: Array<[keyof typeof patch, string]> = [
    ["title", "title"],
    ["description", "description"],
    ["statusId", "status_id"],
    ["priority", "priority"],
    ["assigneeId", "assignee_id"],
    ["parentId", "parent_id"],
    ["epicId", "epic_id"],
    ["sprintId", "sprint_id"],
    ["storyPoints", "story_points"],
    ["originalEstimateSec", "original_estimate_sec"],
    ["remainingEstimateSec", "remaining_estimate_sec"],
    ["startDate", "start_date"],
    ["dueDate", "due_date"],
    ["type", "type"],
  ];

  if (patch.statusId && patch.statusId !== issue.status_id) {
    assertTransitionAllowed({
      projectId: issue.project_id,
      issueId,
      fromStatusId: issue.status_id,
      toStatusId: patch.statusId,
      actorRole: getProjectRole(actor, issue.project_id),
    });
  }

  const before: Record<string, unknown> = {};
  for (const [key, column] of map) {
    if (key in patch && patch[key] !== undefined) {
      fields.push(`${column} = ?`);
      params.push(patch[key] as unknown);
      changes[column] = patch[key];
      before[column] = (issue as unknown as Record<string, unknown>)[column];
    }
  }

  if (fields.length) {
    fields.push(`updated_at = ?`);
    params.push(nowIso());
    params.push(issueId);
    run(`UPDATE issues SET ${fields.join(", ")} WHERE id = ?`, params);
  }

  if (patch.labels) {
    run(`DELETE FROM issue_labels WHERE issue_id = ?`, [issueId]);
    for (const label of patch.labels) {
      const cleaned = label.trim();
      if (!cleaned) continue;
      run(`INSERT OR IGNORE INTO issue_labels (issue_id, label) VALUES (?, ?)`, [
        issueId,
        cleaned,
      ]);
    }
    changes.labels = patch.labels;
  }

  if (patch.assigneeIds) {
    setIssueAssignees(issueId, patch.assigneeIds, {
      actorId: actor.id,
      issueKey: issue.key,
      issueTitle: issue.title,
      projectId: issue.project_id,
      notifyNew: true,
    });
    changes.assignee_ids = patch.assigneeIds;
  } else if (patch.assigneeId !== undefined) {
    setIssueAssignees(issueId, patch.assigneeId ? [patch.assigneeId] : [], {
      actorId: actor.id,
      issueKey: issue.key,
      issueTitle: issue.title,
      projectId: issue.project_id,
      notifyNew: true,
    });
    changes.assignee_id = patch.assigneeId;
  }

  if (patch.statusId && patch.statusId !== issue.status_id) {
    const watchers = all<{ user_id: string }>(
      `SELECT user_id FROM watchers WHERE issue_id = ?`,
      [issueId],
    ).map((w) => w.user_id);
    notifyMany(
      watchers.filter((id) => id !== actor.id),
      {
        type: "status",
        title: `${issue.key}: змінено статус`,
        body: issue.title,
        link: `/projects/${issue.project_id}/issues/${issue.id}`,
      },
    );
  }

  logActivity({
    projectId: issue.project_id,
    issueId,
    actorId: actor.id,
    action: "issue.updated",
    payload: { changes, before },
  });
  bumpBoardVersion(issue.project_id);
  return getIssue(issueId)!;
}

export function moveIssue(params: {
  issueId: string;
  statusId: string;
  beforeId?: string | null;
  afterId?: string | null;
  actor: SessionUser;
}) {
  const issue = getIssue(params.issueId);
  if (!issue) throw new Error("NOT_FOUND");
  if (params.statusId !== issue.status_id) {
    assertTransitionAllowed({
      projectId: issue.project_id,
      issueId: issue.id,
      fromStatusId: issue.status_id,
      toStatusId: params.statusId,
      actorRole: getProjectRole(params.actor, issue.project_id),
    });
  }
  const before = params.beforeId ? getIssue(params.beforeId) : null;
  const after = params.afterId ? getIssue(params.afterId) : null;
  const rank = rankBetween(before?.rank ?? null, after?.rank ?? null);
  run(
    `UPDATE issues SET status_id = ?, rank = ?, updated_at = ? WHERE id = ?`,
    [params.statusId, rank, nowIso(), params.issueId],
  );
  logActivity({
    projectId: issue.project_id,
    issueId: issue.id,
    actorId: params.actor.id,
    action: "issue.moved",
    payload: {
      field: "status_id",
      from: issue.status_id,
      to: params.statusId,
      statusId: params.statusId,
      rank,
    },
  });
  bumpBoardVersion(issue.project_id);
  return getIssue(params.issueId)!;
}

export function addComment(params: {
  issueId: string;
  author: SessionUser;
  body: string;
}) {
  const issue = getIssue(params.issueId);
  if (!issue) throw new Error("NOT_FOUND");
  const id = createId("cmt");
  const ts = nowIso();
  run(
    `INSERT INTO comments (id, issue_id, author_id, body, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, params.issueId, params.author.id, params.body, ts, ts],
  );

  const mentions = extractMentions(params.body);
  if (mentions.length) {
    const users = all<{ id: string; login: string }>(
      `SELECT id, login FROM users WHERE login IN (${mentions.map(() => "?").join(",")})`,
      mentions,
    );
    notifyMany(
      users.map((u) => u.id).filter((id) => id !== params.author.id),
      {
        type: "mention",
        title: `${params.author.name} згадав(ла) вас у ${issue.key}`,
        body: params.body.slice(0, 180),
        link: `/projects/${issue.project_id}/issues/${issue.id}`,
      },
    );
  }

  const watchers = all<{ user_id: string }>(
    `SELECT user_id FROM watchers WHERE issue_id = ?`,
    [params.issueId],
  ).map((w) => w.user_id);
  notifyMany(
    watchers.filter((id) => id !== params.author.id),
    {
      type: "comment",
      title: `Новий коментар у ${issue.key}`,
      body: params.body.slice(0, 180),
      link: `/projects/${issue.project_id}/issues/${issue.id}`,
    },
  );

  logActivity({
    projectId: issue.project_id,
    issueId: issue.id,
    actorId: params.author.id,
    action: "comment.added",
    payload: { commentId: id },
  });
  return id;
}
