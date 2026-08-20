import { NextResponse } from "next/server";
import { getUserFromApiToken } from "@/lib/api-auth";
import { all } from "@/lib/db";
import { addComment, getIssue } from "@/lib/issues";
import { canAccessProject, canComment } from "@/lib/permissions";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string; issueId: string }> },
) {
  const user = getUserFromApiToken(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
    updated_at: string;
    author_id: string;
    author_name: string;
  }>(
    `SELECT c.id, c.body, c.created_at, c.updated_at, c.author_id, u.name as author_name
     FROM comments c JOIN users u ON u.id = c.author_id
     WHERE c.issue_id = ? ORDER BY c.created_at ASC`,
    [issueId],
  );
  return NextResponse.json({ comments });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; issueId: string }> },
) {
  const user = getUserFromApiToken(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, issueId } = await ctx.params;
  if (!canComment(user, id)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const issue = getIssue(issueId);
  if (!issue || issue.project_id !== id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => null)) as { body?: string } | null;
  const text = String(body?.body || "").trim();
  if (!text) {
    return NextResponse.json({ error: "body_required" }, { status: 400 });
  }
  const created = addComment({ issueId, author: user, body: text });
  return NextResponse.json({ id: created.id }, { status: 201 });
}
