import { NextResponse } from "next/server";
import { getIssueAssignees } from "@/lib/assignees";
import { getUserFromApiToken } from "@/lib/api-auth";
import { all } from "@/lib/db";
import { getIssue, getIssueLabels, moveIssue, updateIssue } from "@/lib/issues";
import { canAccessProject, canEditIssues } from "@/lib/permissions";
import type { Priority } from "@/lib/types";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string; issueId: string }> },
) {
  const user = getUserFromApiToken(req.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id, issueId } = await ctx.params;
  if (!canAccessProject(user, id)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const issue = getIssue(issueId);
  if (!issue || issue.project_id !== id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const comments = all<{
    id: string;
    body: string;
    created_at: string;
    author_id: string;
    author_name: string;
  }>(
    `SELECT c.id, c.body, c.created_at, c.author_id, u.name as author_name
     FROM comments c JOIN users u ON u.id = c.author_id
     WHERE c.issue_id = ? ORDER BY c.created_at ASC`,
    [issueId],
  );
  const attachments = all<{
    id: string;
    filename: string;
    size_bytes: number;
    mime_type: string | null;
  }>(
    `SELECT id, filename, size_bytes, mime_type FROM attachments WHERE issue_id = ? ORDER BY created_at DESC`,
    [issueId],
  );

  return NextResponse.json({
    issue,
    assignees: getIssueAssignees(issueId),
    labels: getIssueLabels(issueId),
    comments,
    attachments: attachments.map((a) => ({
      ...a,
      url: `/api/attachments/${a.id}`,
    })),
  });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; issueId: string }> },
) {
  const user = getUserFromApiToken(req.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id, issueId } = await ctx.params;
  if (!canEditIssues(user, id)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const issue = getIssue(issueId);
  if (!issue || issue.project_id !== id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as {
    title?: string;
    description?: string | null;
    statusId?: string;
    priority?: Priority;
    assigneeIds?: string[];
    dueDate?: string | null;
    startDate?: string | null;
  } | null;

  try {
    if (body?.statusId && body.statusId !== issue.status_id) {
      moveIssue({
        issueId,
        statusId: body.statusId,
        actor: user,
      });
    }
    const updated = updateIssue(issueId, user, {
      title: body?.title,
      description: body?.description,
      priority: body?.priority,
      assigneeIds: body?.assigneeIds,
      dueDate: body?.dueDate,
      startDate: body?.startDate,
    });
    return NextResponse.json({ issue: updated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "update_failed" },
      { status: 400 },
    );
  }
}
