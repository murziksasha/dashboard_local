import { NextResponse } from "next/server";
import { getUserFromApiToken } from "@/lib/api-auth";
import { getSessionUser } from "@/lib/auth";
import { heartbeatPresence, listPresence } from "@/lib/presence";

async function userOf(req: Request) {
  return getUserFromApiToken(req.headers.get("authorization")) || (await getSessionUser());
}

export async function POST(req: Request) {
  const user = await userOf(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as {
    projectId?: string;
    issueId?: string;
  } | null;
  heartbeatPresence({
    userId: user.id,
    name: user.name,
    projectId: body?.projectId,
    issueId: body?.issueId,
  });
  return NextResponse.json({
    peers: listPresence({
      projectId: body?.projectId,
      issueId: body?.issueId,
      excludeUserId: user.id,
    }),
  });
}

export async function GET(req: Request) {
  const user = await userOf(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  return NextResponse.json({
    peers: listPresence({
      projectId: url.searchParams.get("projectId") || undefined,
      issueId: url.searchParams.get("issueId") || undefined,
      excludeUserId: user.id,
    }),
  });
}
