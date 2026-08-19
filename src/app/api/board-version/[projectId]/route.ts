import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessProject } from "@/lib/permissions";
import { getProjectById } from "@/lib/projects";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ projectId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { projectId } = await ctx.params;
  if (!canAccessProject(user, projectId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const project = getProjectById(projectId);
  return NextResponse.json({ version: project?.board_version ?? 0 });
}
