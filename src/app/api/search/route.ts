import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { searchIssues } from "@/lib/search";
import { listProjectsForUser } from "@/lib/projects";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q") || "";
  const issues = searchIssues(user, q, 15);
  const projects = q
    ? listProjectsForUser(user).filter(
        (p) =>
          p.name.toLowerCase().includes(q.toLowerCase()) ||
          p.key.toLowerCase().includes(q.toLowerCase()),
      )
    : [];
  return NextResponse.json({
    issues,
    projects: projects.slice(0, 5).map((p) => ({ id: p.id, key: p.key, name: p.name })),
  });
}
