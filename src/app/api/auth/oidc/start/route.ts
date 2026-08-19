import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/app-url";
import { nowIso, run } from "@/lib/db";
import { buildOidcAuthUrl, isOidcEnabled } from "@/lib/oidc";

export async function GET(req: Request) {
  const base = getAppBaseUrl(req.url);
  if (!isOidcEnabled()) {
    return NextResponse.redirect(`${base}/login?error=oidc_disabled`);
  }

  const state = randomBytes(16).toString("hex");
  const codeVerifier = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  run(
    `INSERT INTO oidc_states (state, code_verifier, expires_at) VALUES (?, ?, ?)`,
    [state, codeVerifier, expires],
  );
  run(`DELETE FROM oidc_states WHERE expires_at < ?`, [nowIso()]);

  try {
    const url = await buildOidcAuthUrl(state, codeVerifier);
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.redirect(`${base}/login?error=oidc_config`);
  }
}
