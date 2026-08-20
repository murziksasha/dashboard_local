import { all, count, get, nowIso, run } from "./db";
import { createId } from "./id";

export const LOGIN_FAIL_WINDOW_MIN = 15;
export const LOGIN_FAIL_MAX = 5;
export const LOGIN_LOCK_MIN = 15;

export type AuditAction =
  | "login.ok"
  | "login.fail"
  | "login.lock"
  | "backup.restore"
  | "backup.create";

export type AuditRow = {
  id: string;
  action: string;
  user_id: string | null;
  login: string | null;
  ip: string | null;
  user_agent: string | null;
  detail: string | null;
  created_at: string;
};

export function logAudit(params: {
  action: AuditAction | string;
  userId?: string | null;
  login?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  detail?: string | null;
}) {
  run(
    `INSERT INTO audit_events (id, action, user_id, login, ip, user_agent, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      createId("aud"),
      params.action,
      params.userId ?? null,
      params.login ?? null,
      params.ip ?? null,
      params.userAgent ?? null,
      params.detail ?? null,
      nowIso(),
    ],
  );
}

export function listAuditEvents(limit = 200): AuditRow[] {
  return all<AuditRow>(
    `SELECT id, action, user_id, login, ip, user_agent, detail, created_at
     FROM audit_events
     ORDER BY created_at DESC
     LIMIT ?`,
    [limit],
  );
}

export function countRecentLoginFails(login: string, ip: string): number {
  return count(
    `SELECT COUNT(*) as c FROM audit_events
     WHERE action = 'login.fail'
       AND login = ? COLLATE NOCASE
       AND ip = ?
       AND created_at > datetime('now', ?)`,
    [login, ip, `-${LOGIN_FAIL_WINDOW_MIN} minutes`],
  );
}

export function isLoginLocked(login: string, ip: string): { locked: boolean; retryMin: number } {
  const lastFail = get<{ created_at: string }>(
    `SELECT created_at FROM audit_events
     WHERE action = 'login.fail'
       AND login = ? COLLATE NOCASE
       AND ip = ?
     ORDER BY created_at DESC LIMIT 1`,
    [login, ip],
  );
  const fails = countRecentLoginFails(login, ip);
  if (fails < LOGIN_FAIL_MAX) return { locked: false, retryMin: 0 };
  if (!lastFail) return { locked: true, retryMin: LOGIN_LOCK_MIN };
  const elapsedMin = (Date.now() - new Date(lastFail.created_at).getTime()) / 60000;
  const retryMin = Math.max(1, Math.ceil(LOGIN_LOCK_MIN - elapsedMin));
  if (elapsedMin >= LOGIN_LOCK_MIN) return { locked: false, retryMin: 0 };
  return { locked: true, retryMin };
}

export function assertLoginAllowed(login: string, ip: string): string | null {
  const state = isLoginLocked(login, ip);
  if (!state.locked) return null;
  return `Забагато спроб входу. Спробуйте ще раз через ${state.retryMin} хв.`;
}
