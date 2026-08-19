import { NextResponse } from "next/server";
import { getUserFromApiToken } from "@/lib/api-auth";
import { canAccessProject } from "@/lib/permissions";
import { getProjectById, listStatuses } from "@/lib/projects";

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
  const project = getProjectById(id);
  if (!project || project.archived) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({
    project,
    statuses: listStatuses(id),
  });
}
