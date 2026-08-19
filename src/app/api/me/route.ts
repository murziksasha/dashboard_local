import { NextResponse } from "next/server";
import { getUserFromApiToken } from "@/lib/api-auth";

export async function GET(req: Request) {
  const user = getUserFromApiToken(req.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ user });
}
