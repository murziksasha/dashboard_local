import { cookies } from "next/headers";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { all, get, nowIso, run, settingGet } from "./db";
import { createId } from "./id";
import type { SessionUser } from "./types";

const SESSION_COOKIE = "dl_session";
const SESSION_DAYS = 14;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!stored || stored.startsWith("!ldap!")) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 64);
  const prev = Buffer.from(hash, "hex");
  if (next.length !== prev.length) return false;
  return timingSafeEqual(next, prev);
}

export function ldapPasswordPlaceholder(): string {
  return `!ldap!${randomBytes(16).toString("hex")}`;
}

export function isSetupComplete(): boolean {
  return settingGet("setup_complete") === "1";
}

export async function createSession(userId: string): Promise<string> {
  const id = createId("ses");
  const expires = new Date();
  expires.setDate(expires.getDate() + SESSION_DAYS);
  run(
    `INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`,
    [id, userId, expires.toISOString(), nowIso()],
  );
  const jar = await cookies();
  jar.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    expires,
  });
  return id;
}

export async function destroySession() {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (id) {
    run(`DELETE FROM sessions WHERE id = ?`, [id]);
    jar.delete(SESSION_COOKIE);
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (!id) return null;
  const row = get<SessionUser & { expires_at: string; active: number }>(
    `SELECT u.id, u.login, u.name, u.email, u.global_role, u.active, s.expires_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ?`,
    [id],
  );
  if (!row || !row.active) {
    if (id) run(`DELETE FROM sessions WHERE id = ?`, [id]);
    return null;
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    run(`DELETE FROM sessions WHERE id = ?`, [id]);
    return null;
  }
  return {
    id: row.id,
    login: row.login,
    name: row.name,
    email: row.email,
    global_role: row.global_role,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.global_role !== "admin") throw new Error("FORBIDDEN");
  return user;
}

export function cleanupExpiredSessions() {
  run(`DELETE FROM sessions WHERE expires_at < ?`, [nowIso()]);
}

export function avatarColor(seed: string): string {
  const hash = createHash("md5").update(seed).digest("hex");
  const hue = parseInt(hash.slice(0, 2), 16) % 360;
  return `hsl(${hue} 55% 42%)`;
}

export function listActiveUsers() {
  return all<SessionUser & { active: number }>(
    `SELECT id, login, name, email, global_role, active FROM users WHERE active = 1 ORDER BY name`,
  );
}
