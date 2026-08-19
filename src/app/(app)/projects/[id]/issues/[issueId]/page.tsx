import Link from "next/link";
import { notFound } from "next/navigation";
import { IssueDetailClient } from "@/components/issues/issue-detail-client";
import {
  AttachmentsPanel,
  CommentsPanel,
  LinksPanel,
  WorklogsPanel,
} from "@/components/issues/issue-side-panels";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { all, get } from "@/lib/db";
import { getIssueAssignees } from "@/lib/assignees";
import { getIssue, getIssueLabels } from "@/lib/issues";
import { canComment, canEditIssues } from "@/lib/permissions";
import { loadProjectContext } from "@/lib/project-page";
import { formatDate } from "@/lib/utils";

export default async function IssuePage({
  params,
}: {
  params: Promise<{ id: string; issueId: string }>;
}) {
  const { id, issueId } = await params;
  const user = await requireUser();
  const ctx = loadProjectContext(user, id);
  const issue = getIssue(issueId);
  if (!issue || issue.project_id !== id) notFound();

  const labels = getIssueLabels(issueId);
  const assignees = getIssueAssignees(issueId);
  const comments = all<{
    id: string;
    body: string;
    created_at: string;
    name: string;
    author_id: string;
  }>(
    `SELECT c.id, c.body, c.created_at, c.author_id, u.name
     FROM comments c JOIN users u ON u.id = c.author_id
     WHERE c.issue_id = ? ORDER BY c.created_at ASC`,
    [issueId],
  );
  const subtasks = all<{ id: string; key: string; title: string; status_name: string }>(
    `SELECT i.id, i.key, i.title, s.name as status_name
     FROM issues i JOIN statuses s ON s.id = i.status_id
     WHERE i.parent_id = ? ORDER BY i.rank`,
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
  }>(
    `SELECT id, filename, size_bytes, created_at FROM attachments WHERE issue_id = ? ORDER BY created_at DESC`,
    [issueId],
  );
  const links = all<{
    id: string;
    link_type: string;
    other_key: string;
    other_id: string;
    other_title: string;
  }>(
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
    [issueId, id],
  );
  const watching = !!get(
    `SELECT user_id FROM watchers WHERE issue_id = ? AND user_id = ?`,
    [issueId, user.id],
  );

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/projects/${id}`} className="text-sm text-sky-600 hover:underline">
          ← До дошки
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge tone="sky">{issue.key}</Badge>
          <h1 className="text-2xl font-bold">{issue.title}</h1>
        </div>
      </div>

      <IssueDetailClient
        issue={{
          id: issue.id,
          project_id: issue.project_id,
          key: issue.key,
          title: issue.title,
          description: issue.description,
          type: issue.type,
          priority: issue.priority,
          status_id: issue.status_id,
          assignee_id: issue.assignee_id,
          epic_id: issue.epic_id,
          sprint_id: issue.sprint_id,
          story_points: issue.story_points,
          original_estimate_sec: issue.original_estimate_sec,
          remaining_estimate_sec: issue.remaining_estimate_sec,
          start_date: issue.start_date ?? null,
          due_date: issue.due_date,
        }}
        labels={labels}
        assigneeIds={assignees.map((a) => a.id)}
        statuses={ctx.statuses}
        users={ctx.users}
        sprints={ctx.sprints}
        epics={ctx.epics.map((e) => ({ id: e.id, key: e.key, title: e.title }))}
        customFields={customFields}
        watching={watching}
        canEdit={canEditIssues(user, id)}
        canComment={canComment(user, id)}
      />

      {subtasks.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Підзадачі</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {subtasks.map((s) => (
              <Link
                key={s.id}
                href={`/projects/${id}/issues/${s.id}`}
                className="flex justify-between rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
              >
                <span>
                  <span className="font-medium text-sky-600">{s.key}</span> {s.title}
                </span>
                <span className="text-zinc-500">{s.status_name}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Коментарі</CardTitle>
          </CardHeader>
          <CardContent>
            <CommentsPanel
              projectId={id}
              comments={comments}
              currentUserId={user.id}
              isAdmin={user.global_role === "admin"}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Історія</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activity.map((a) => (
              <div key={a.id} className="text-sm">
                <span className="font-medium">{a.name || "Система"}</span>{" "}
                <span className="text-zinc-500">{a.action}</span>
                <div className="text-xs text-zinc-400">{formatDate(a.created_at, true)}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Вкладення</CardTitle>
          </CardHeader>
          <CardContent>
            <AttachmentsPanel
              attachments={attachments}
              canManage={canEditIssues(user, id)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Звʼязки та час</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-zinc-400">Links</p>
              <LinksPanel
                projectId={id}
                links={links}
                canManage={canEditIssues(user, id)}
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-zinc-400">Work log</p>
              <WorklogsPanel worklogs={worklogs} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
