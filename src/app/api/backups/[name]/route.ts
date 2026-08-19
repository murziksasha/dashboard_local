import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getBackupsDir } from "@/lib/paths";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ name: string }> },
) {
  const user = await getSessionUser();
  if (!user || user.global_role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { name } = await ctx.params;
  const safe = path.basename(name);
  if (!safe.endsWith(".db")) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const filePath = path.join(getBackupsDir(), safe);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const buffer = fs.readFileSync(filePath);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safe}"`,
    },
  });
}
