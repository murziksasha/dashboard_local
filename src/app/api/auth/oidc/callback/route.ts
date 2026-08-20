import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/app-url";
import { logAudit } from "@/lib/audit";
import { createSession, ldapPasswordPlaceholder } from "@/lib/auth";
import { get, nowIso, run } from "@/lib/db";
import { createId } from "@/lib/id";
import { exchangeOidcCode } from "@/lib/oidc";
import { clientIpFromHeaders, userAgentFromHeaders } from "@/lib/request-ip";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = getAppBaseUrl(req.url);
  const state = url.searchParams.get("state") || "";
  const row = get<{ code_verifier: string; expires_at: string }>(
    `SELECT code_verifier, expires_at FROM oidc_states WHERE state = ?`,
    [state],
  );
  run(`DELETE FROM oidc_states WHERE state = ?`, [state]);

  if (!row || new Date(row.expires_at).getTime() < Date.now()) {
    return NextResponse.redirect(`${base}/login?error=oidc_state`);
  }

  try {
    const profile = await exchangeOidcCode({
      callbackUrl: url,
      codeVerifier: row.code_verifier,
      expectedState: state,
    });

    const login =
      profile.login.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 64) || "sso";
    let user = get<{
      id: string;
      active: number;
      global_role: "admin" | "user";
    }>(`SELECT id, active, global_role FROM users WHERE login = ? COLLATE NOCASE`, [
      login,
    ]);

    if (!user && profile.email) {
      user = get(
        `SELECT id, active, global_role FROM users WHERE email = ? COLLATE NOCASE`,
        [profile.email],
      ) as typeof user;
    }

    if (user && !user.active) {
      logAudit({
        action: "login.fail",
        login,
        ip: clientIpFromHeaders(req.headers),
        userAgent: userAgentFromHeaders(req.headers),
        detail: "oidc_disabled",
      });
      return NextResponse.redirect(`${base}/login?error=disabled`);
    }

    let userId = user?.id;
    if (!userId) {
      userId = createId("usr");
      const ts = nowIso();
      run(
        `INSERT INTO users (id, login, name, email, password_hash, global_role, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'user', 1, ?, ?)`,
        [
          userId,
          login,
          profile.name,
          profile.email,
          ldapPasswordPlaceholder(),
          ts,
          ts,
        ],
      );
    } else {
      run(
        `UPDATE users SET name = ?, email = COALESCE(?, email), updated_at = ? WHERE id = ?`,
        [profile.name, profile.email, nowIso(), userId],
      );
    }

    await createSession(userId);
    logAudit({
      action: "login.ok",
      userId,
      login,
      ip: clientIpFromHeaders(req.headers),
      userAgent: userAgentFromHeaders(req.headers),
      detail: "oidc",
    });
    return NextResponse.redirect(`${base}/dashboard`);
  } catch {
    logAudit({
      action: "login.fail",
      ip: clientIpFromHeaders(req.headers),
      userAgent: userAgentFromHeaders(req.headers),
      detail: "oidc_failed",
    });
    return NextResponse.redirect(`${base}/login?error=oidc_failed`);
  }
}
