import { getIssueAssignees } from "./assignees";
import { all, get } from "./db";
import { getIssue, getIssueLabels } from "./issues";
import { canComment, canEditIssues } from "./permissions";
import type { SessionUser } from "./types";

export type IssueComment = {
  id: string;
  body: string;
  created_at: string;
  name: string;
  author_id: string;
};

export type IssueLinkRow = {
  id: string;
  link_type: string;
  other_key: string;
  other_id: string;
  other_title: string;
};

export type IssueWorkspacePayload = {
  issue: NonNullable<ReturnType<typeof getIssue>>;
  labels: string[];
  assigneeIds: string[];
  comments: IssueComment[];
  subtasks: Array<{ id: string; key: string; title: string; status_name: string }>;
  activity: Array<{
    id: string;
    action: string;
    created_at: string;
    name: string | null;
    payload_json: string | null;
  }>;
  attachments: Array<{
    id: string;
    filename: string;
    size_bytes: number;
    created_at: string;
    mime_type: string | null;
  }>;
  links: IssueLinkRow[];
  worklogs: Array<{
    id: string;
    seconds: number;
    work_date: string;
    note: string | null;
    name: string;
  }>;
  customFields: Array<{
    id: string;
    name: string;
    field_type: string;
    options_json: string | null;
    value: string | null;
  }>;
  watching: boolean;
  canEdit: boolean;
  canComment: boolean;
};

export function listProjectLabels(projectId: string): string[] {
  return all<{ label: string }>(
    `SELECT DISTINCT il.label
     FROM issue_labels il
     JOIN issues i ON i.id = il.issue_id
     WHERE i.project_id = ?
     ORDER BY il.label`,
    [projectId],
  ).map((r) => r.label);
}

export function loadIssueWorkspace(
  user: SessionUser,
  projectId: string,
  issueId: string,
): IssueWorkspacePayload | null {
  const issue = getIssue(issueId);
  if (!issue || issue.project_id !== projectId) return null;

  const comments = all<IssueComment>(
    `SELECT c.id, c.body, c.created_at, c.author_id, u.name
     FROM comments c JOIN users u ON u.id = c.author_id
     WHERE c.issue_id = ? ORDER BY c.created_at ASC`,
    [issueId],
  );
  const subtasks = all<{ id: string; key: string; title: string; status_name: string }>(
    `SELECT i.id, i.key, i.title, s.name as status_name
     FROM issues i JOIN statuses s ON s.id = i.status_id
     WHERE i.parent_id = ? AND i.deleted_at IS NULL ORDER BY i.rank`,
    [issueId],
  );
  const activity = all<{
    id: string;
    action: string;
    created_at: string;
    name: string | null;
    payload_json: string | null;
  }>(
    `SELECT a.id, a.action, a.created_at, a.payload_json, u.name
     FROM activity_events a
     LEFT JOIN users u ON u.id = a.actor_id
     WHERE a.issue_id = ?
     ORDER BY a.created_at DESC LIMIT 30`,
    [issueId],
  );
  const attachments = all<{
    id: string;
    filename: string;
    size_bytes: number;
    created_at: string;
    mime_type: string | null;
  }>(
    `SELECT id, filename, size_bytes, created_at, mime_type FROM attachments WHERE issue_id = ? ORDER BY created_at DESC`,
    [issueId],
  );
  const links = all<IssueLinkRow>(
    `SELECT l.id, l.link_type, i.key as other_key, i.id as other_id, i.title as other_title
     FROM issue_links l
     JOIN issues i ON i.id = l.to_issue_id
     WHERE l.from_issue_id = ?
     UNION ALL
     SELECT l.id,
            CASE l.link_type
              WHEN 'blocks' THEN 'is blocked by'
              ELSE l.link_type || ' (вхідний)'
            END,
            i.key, i.id, i.title
     FROM issue_links l
     JOIN issues i ON i.id = l.from_issue_id
     WHERE l.to_issue_id = ?`,
    [issueId, issueId],
  );
  const worklogs = all<{
    id: string;
    seconds: number;
    work_date: string;
    note: string | null;
    name: string;
  }>(
    `SELECT w.id, w.seconds, w.work_date, w.note, u.name
     FROM worklogs w JOIN users u ON u.id = w.user_id
     WHERE w.issue_id = ? ORDER BY w.work_date DESC`,
    [issueId],
  );
  const customFields = all<{
    id: string;
    name: string;
    field_type: string;
    options_json: string | null;
    value: string | null;
  }>(
    `SELECT d.id, d.name, d.field_type, d.options_json, v.value
     FROM custom_field_defs d
     LEFT JOIN custom_field_values v ON v.field_id = d.id AND v.issue_id = ?
     WHERE d.project_id = ?
     ORDER BY d.position`,
    [issueId, projectId],
  );

  return {
    issue,
    labels: getIssueLabels(issueId),
    assigneeIds: getIssueAssignees(issueId).map((a) => a.id),
    comments,
    subtasks,
    activity,
    attachments,
    links,
    worklogs,
    customFields,
    watching: !!get(
      `SELECT user_id FROM watchers WHERE issue_id = ? AND user_id = ?`,
      [issueId, user.id],
    ),
    canEdit: canEditIssues(user, projectId),
    canComment: canComment(user, projectId),
  };
}

export function safeFromPath(raw: string | undefined, fallback: string): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) {
    return fallback;
  }
  return raw;
}
