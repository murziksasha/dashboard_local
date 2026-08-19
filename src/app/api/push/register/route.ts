import { NextResponse } from "next/server";
import { getUserFromApiToken } from "@/lib/api-auth";
import { removePushToken, upsertPushToken } from "@/lib/push";

export async function POST(req: Request) {
  const user = getUserFromApiToken(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    token?: string;
    platform?: string;
    deviceName?: string;
  } | null;
  const token = String(body?.token || "").trim();
  if (!token) {
    return NextResponse.json({ error: "token_required" }, { status: 400 });
  }

  const id = upsertPushToken({
    userId: user.id,
    token,
    platform: body?.platform ? String(body.platform) : null,
    deviceName: body?.deviceName ? String(body.deviceName) : null,
  });
  return NextResponse.json({ ok: true, id });
}

export async function DELETE(req: Request) {
  const user = getUserFromApiToken(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { token?: string } | null;
  const token = String(body?.token || "").trim();
  if (!token) {
    return NextResponse.json({ error: "token_required" }, { status: 400 });
  }
  removePushToken(user.id, token);
  return NextResponse.json({ ok: true });
}
