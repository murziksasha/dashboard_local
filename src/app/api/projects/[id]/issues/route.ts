import { NextResponse } from "next/server";
import { getUserFromApiToken } from "@/lib/api-auth";
import { createIssue, listIssues } from "@/lib/issues";
import { canAccessProject, canEditIssues } from "@/lib/permissions";
import type { IssueType, Priority } from "@/lib/types";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = getUserFromApiToken(req.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!canAccessProject(user, id)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const q = url.searchParams.get("q") || undefined;
  const issues = listIssues(id, q ? { q } : {});
  return NextResponse.json({ issues });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = getUserFromApiToken(req.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!canEditIssues(user, id)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as {
    title?: string;
    type?: string;
    description?: string;
    priority?: string;
    assigneeIds?: string[];
    statusId?: string;
  } | null;
  const title = String(body?.title || "").trim();
  if (!title) {
    return NextResponse.json({ error: "title_required" }, { status: 400 });
  }
  try {
    const issue = createIssue({
      projectId: id,
      type: (body?.type as IssueType) || "task",
      title,
      description: body?.description,
      priority: (body?.priority as Priority) || "medium",
      assigneeIds: body?.assigneeIds || [],
      statusId: body?.statusId,
      reporterId: user.id,
      actor: user,
    });
    return NextResponse.json({ issue }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "create_failed" },
      { status: 400 },
    );
  }
}
