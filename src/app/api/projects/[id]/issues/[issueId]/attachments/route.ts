import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { getUserFromApiToken } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity";
import { all, nowIso, run } from "@/lib/db";
import { createId } from "@/lib/id";
import { getIssue } from "@/lib/issues";
import { getUploadsDir } from "@/lib/paths";
import { canAccessProject, canComment, canEditIssues } from "@/lib/permissions";

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
  const attachments = all<{
    id: string;
    filename: string;
    mime_type: string | null;
    size_bytes: number;
    created_at: string;
  }>(
    `SELECT id, filename, mime_type, size_bytes, created_at
     FROM attachments WHERE issue_id = ? ORDER BY created_at DESC`,
    [issueId],
  );
  return NextResponse.json({
    attachments: attachments.map((a) => ({
      ...a,
      url: `/api/attachments/${a.id}`,
    })),
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; issueId: string }> },
) {
  const user = getUserFromApiToken(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, issueId } = await ctx.params;
  if (!canEditIssues(user, id) && !canComment(user, id)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const issue = getIssue(issueId);
  if (!issue || issue.project_id !== id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "file_required" }, { status: 400 });
  }
  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "file_too_large" }, { status: 400 });
  }

  const dir = path.join(getUploadsDir(), id);
  fs.mkdirSync(dir, { recursive: true });
  const attachmentId = createId("att");
  const safeName = file.name.replace(/[^\w.\-()\sа-яА-ЯіІїЇєЄґҐ]/g, "_");
  const stored = `${attachmentId}_${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(path.join(dir, stored), buffer);

  run(
    `INSERT INTO attachments (id, issue_id, uploader_id, filename, stored_name, mime_type, size_bytes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      attachmentId,
      issueId,
      user.id,
      file.name,
      stored,
      file.type || null,
      file.size,
      nowIso(),
    ],
  );
  logActivity({
    projectId: id,
    issueId,
    actorId: user.id,
    action: "attachment.added",
    payload: { filename: file.name },
  });

  return NextResponse.json(
    {
      id: attachmentId,
      filename: file.name,
      url: `/api/attachments/${attachmentId}`,
    },
    { status: 201 },
  );
}
