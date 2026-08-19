import { createHash, randomBytes } from "crypto";
import { get, nowIso, run } from "./db";
import { createId } from "./id";
import type { SessionUser } from "./types";
import { verifyPassword } from "./auth";

const API_TOKEN_PREFIX = "dl_";

export function hashApiToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function issueApiToken(userId: string): string {
  const raw = API_TOKEN_PREFIX + randomBytes(24).toString("hex");
  const id = createId("tok");
  const expires = new Date();
  expires.setDate(expires.getDate() + 30);
  run(
    `INSERT INTO api_tokens (id, user_id, token_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, userId, hashApiToken(raw), expires.toISOString(), nowIso()],
  );
  return raw;
}

export function getUserFromApiToken(token: string | null): SessionUser | null {
  if (!token) return null;
  const cleaned = token.replace(/^Bearer\s+/i, "").trim();
  if (!cleaned) return null;
  const row = get<
    SessionUser & { expires_at: string; active: number }
  >(
    `SELECT u.id, u.login, u.name, u.email, u.global_role, u.active, t.expires_at
     FROM api_tokens t
     JOIN users u ON u.id = t.user_id
     WHERE t.token_hash = ?`,
    [hashApiToken(cleaned)],
  );
  if (!row || !row.active) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return {
    id: row.id,
    login: row.login,
    name: row.name,
    email: row.email,
    global_role: row.global_role,
  };
}

export function loginWithPassword(
  login: string,
  password: string,
): SessionUser | null {
  const user = get<SessionUser & { password_hash: string; active: number }>(
    `SELECT id, login, name, email, global_role, password_hash, active
     FROM users WHERE login = ? COLLATE NOCASE`,
    [login],
  );
  if (!user || !user.active) return null;
  if (!verifyPassword(password, user.password_hash)) return null;
  return {
    id: user.id,
    login: user.login,
    name: user.name,
    email: user.email,
    global_role: user.global_role,
  };
}
