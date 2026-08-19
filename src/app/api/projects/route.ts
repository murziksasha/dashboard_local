import { NextResponse } from "next/server";
import { getUserFromApiToken } from "@/lib/api-auth";
import { listProjectsForUser } from "@/lib/projects";

export async function GET(req: Request) {
  const user = getUserFromApiToken(req.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const projects = listProjectsForUser(user);
  return NextResponse.json({ projects });
}
