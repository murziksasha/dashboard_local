import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { getUserFromApiToken } from "@/lib/api-auth";
import { getSessionUser } from "@/lib/auth";
import { get } from "@/lib/db";
import { getUploadsDir } from "@/lib/paths";
import { canAccessProject } from "@/lib/permissions";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user =
    getUserFromApiToken(req.headers.get("authorization")) ||
    (await getSessionUser());
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const row = get<{
    filename: string;
    stored_name: string;
    mime_type: string | null;
    project_id: string;
  }>(
    `SELECT a.filename, a.stored_name, a.mime_type, i.project_id
     FROM attachments a
     JOIN issues i ON i.id = a.issue_id
     WHERE a.id = ?`,
    [id],
  );
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!canAccessProject(user, row.project_id)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const filePath = path.join(getUploadsDir(), row.project_id, row.stored_name);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "missing file" }, { status: 404 });
  }
  const buffer = fs.readFileSync(filePath);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": row.mime_type || "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(row.filename)}`,
    },
  });
}
