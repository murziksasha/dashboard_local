import { NextResponse } from "next/server";
import { getUserFromApiToken } from "@/lib/api-auth";
import { getSessionUser } from "@/lib/auth";
import { canAccessProject } from "@/lib/permissions";
import { heartbeatPresence, listPresence } from "@/lib/presence";
import { getIssueProjectId } from "@/lib/uploads";

async function userOf(req: Request) {
  return getUserFromApiToken(req.headers.get("authorization")) || (await getSessionUser());
}

function resolveAuthorizedProject(
  user: NonNullable<Awaited<ReturnType<typeof userOf>>>,
  projectId?: string,
  issueId?: string,
): { ok: true; projectId: string } | { ok: false; status: number } {
  const pid = projectId || (issueId ? getIssueProjectId(issueId) : undefined);
  if (!pid) return { ok: false, status: 400 };
  if (!canAccessProject(user, pid)) return { ok: false, status: 403 };
  return { ok: true, projectId: pid };
}

export async function POST(req: Request) {
  const user = await userOf(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as {
    projectId?: string;
    issueId?: string;
  } | null;
  const authz = resolveAuthorizedProject(user, body?.projectId, body?.issueId);
  if (!authz.ok) {
    return NextResponse.json(
      { error: authz.status === 403 ? "forbidden" : "project_required" },
      { status: authz.status },
    );
  }
  heartbeatPresence({
    userId: user.id,
    name: user.name,
    projectId: authz.projectId,
    issueId: body?.issueId,
  });
  return NextResponse.json({
    peers: listPresence({
      projectId: authz.projectId,
      issueId: body?.issueId,
      excludeUserId: user.id,
    }),
  });
}

export async function GET(req: Request) {
  const user = await userOf(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId") || undefined;
  const issueId = url.searchParams.get("issueId") || undefined;
  const authz = resolveAuthorizedProject(user, projectId, issueId);
  if (!authz.ok) {
    return NextResponse.json(
      { error: authz.status === 403 ? "forbidden" : "project_required" },
      { status: authz.status },
    );
  }
  return NextResponse.json({
    peers: listPresence({
      projectId: authz.projectId,
      issueId,
      excludeUserId: user.id,
    }),
  });
}
