import { NextResponse } from "next/server";
import { issueApiToken, loginWithPassword } from "@/lib/api-auth";
import { ldapPasswordPlaceholder } from "@/lib/auth";
import { get, nowIso, run } from "@/lib/db";
import { createId } from "@/lib/id";
import { isLdapEnabled, ldapAuthenticate } from "@/lib/ldap";
import type { SessionUser } from "@/lib/types";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    login?: string;
    password?: string;
  } | null;
  const login = String(body?.login || "").trim();
  const password = String(body?.password || "");
  if (!login || !password) {
    return NextResponse.json({ error: "login_password_required" }, { status: 400 });
  }

  let user: SessionUser | null = loginWithPassword(login, password);

  if (!user && isLdapEnabled()) {
    const profile = await ldapAuthenticate(login, password);
    if (profile) {
      const existing = get<{
        id: string;
        active: number;
        global_role: "admin" | "user";
        name: string;
        email: string | null;
      }>(
        `SELECT id, active, global_role, name, email FROM users WHERE login = ? COLLATE NOCASE`,
        [profile.login],
      );
      if (existing && !existing.active) {
        return NextResponse.json({ error: "disabled" }, { status: 403 });
      }
      if (existing) {
        run(
          `UPDATE users SET name = ?, email = COALESCE(?, email), updated_at = ? WHERE id = ?`,
          [profile.name, profile.email, nowIso(), existing.id],
        );
        user = {
          id: existing.id,
          login: profile.login,
          name: profile.name,
          email: profile.email ?? existing.email,
          global_role: existing.global_role,
        };
      } else {
        const id = createId("usr");
        const ts = nowIso();
        run(
          `INSERT INTO users (id, login, name, email, password_hash, global_role, active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'user', 1, ?, ?)`,
          [
            id,
            profile.login,
            profile.name,
            profile.email,
            ldapPasswordPlaceholder(),
            ts,
            ts,
          ],
        );
        user = {
          id,
          login: profile.login,
          name: profile.name,
          email: profile.email,
          global_role: "user",
        };
      }
    }
  }

  if (!user) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const token = issueApiToken(user.id);
  return NextResponse.json({ token, user });
}
