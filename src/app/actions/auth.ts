"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  createSession,
  destroySession,
  hashPassword,
  isSetupComplete,
  ldapPasswordPlaceholder,
  verifyPassword,
} from "@/lib/auth";
import {
  LOGIN_FAIL_MAX,
  assertLoginAllowed,
  countRecentLoginFails,
  logAudit,
} from "@/lib/audit";
import { get, nowIso, run, settingSet } from "@/lib/db";
import { createId } from "@/lib/id";
import { isLdapEnabled, ldapAuthenticate } from "@/lib/ldap";
import { clientIpFromHeaders, userAgentFromHeaders } from "@/lib/request-ip";
import { passwordPolicyError } from "@/lib/password-policy";
import { seedDemo } from "@/lib/seed";
import type { SessionUser } from "@/lib/types";
import { LoginInput, parseWith, SetupInput } from "@/lib/validation";

async function loginMeta() {
  const h = await headers();
  return {
    ip: clientIpFromHeaders(h),
    userAgent: userAgentFromHeaders(h),
  };
}

export async function setupAction(formData: FormData) {
  if (isSetupComplete()) redirect("/login");

  const parsed = parseWith(SetupInput, {
    name: String(formData.get("name") || ""),
    login: String(formData.get("login") || ""),
    password: String(formData.get("password") || ""),
    appName: String(formData.get("appName") || "Dashboard Local"),
  });
  if (!parsed.ok) return { error: parsed.error };
  const { name, login, password } = parsed.data;
  const appName = parsed.data.appName?.trim() || "Dashboard Local";
  const withDemo = formData.get("demo") === "on";
  const policy = passwordPolicyError(password, login);
  if (policy) return { error: policy };

  const exists = get(`SELECT id FROM users WHERE login = ? COLLATE NOCASE`, [
    login,
  ]);
  if (exists) return { error: "Такий логін уже існує." };

  const id = createId("usr");
  const ts = nowIso();
  run(
    `INSERT INTO users (id, login, name, email, password_hash, global_role, active, created_at, updated_at)
     VALUES (?, ?, ?, NULL, ?, 'admin', 1, ?, ?)`,
    [id, login, name, hashPassword(password), ts, ts],
  );
  settingSet("setup_complete", "1");
  settingSet("app_name", appName || "Dashboard Local");
  settingSet("backup_hour", "2");

  const admin: SessionUser = {
    id,
    login,
    name,
    email: null,
    global_role: "admin",
  };
  if (withDemo) seedDemo(admin);

  await createSession(id);
  redirect("/dashboard");
}

async function ensureLdapUser(profile: {
  login: string;
  name: string;
  email: string | null;
}): Promise<string> {
  const existing = get<{ id: string; active: number }>(
    `SELECT id, active FROM users WHERE login = ? COLLATE NOCASE`,
    [profile.login],
  );
  if (existing) {
    if (!existing.active) throw new Error("ACCOUNT_DISABLED");
    run(
      `UPDATE users SET name = ?, email = COALESCE(?, email), updated_at = ? WHERE id = ?`,
      [profile.name, profile.email, nowIso(), existing.id],
    );
    return existing.id;
  }
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
  return id;
}

export async function loginAction(formData: FormData) {
  if (!isSetupComplete()) redirect("/setup");
  const parsed = parseWith(LoginInput, {
    login: String(formData.get("login") || ""),
    password: String(formData.get("password") || ""),
  });
  if (!parsed.ok) return { error: parsed.error };
  const { login, password } = parsed.data;
  const { ip, userAgent } = await loginMeta();

  const locked = assertLoginAllowed(login, ip);
  if (locked) return { error: locked };

  const local = get<{
    id: string;
    password_hash: string;
    active: number;
  }>(
    `SELECT id, password_hash, active FROM users WHERE login = ? COLLATE NOCASE`,
    [login],
  );

  if (local?.active && verifyPassword(password, local.password_hash)) {
    logAudit({ action: "login.ok", userId: local.id, login, ip, userAgent, detail: "local" });
    await createSession(local.id);
    redirect("/dashboard");
  }

  if (isLdapEnabled()) {
    const profile = await ldapAuthenticate(login, password);
    if (profile) {
      try {
        const userId = await ensureLdapUser(profile);
        logAudit({ action: "login.ok", userId, login, ip, userAgent, detail: "ldap" });
        await createSession(userId);
        redirect("/dashboard");
      } catch {
        logAudit({ action: "login.fail", login, ip, userAgent, detail: "disabled" });
        return { error: "Обліковий запис вимкнено." };
      }
    }
  }

  logAudit({ action: "login.fail", login, ip, userAgent, detail: "invalid" });
  if (countRecentLoginFails(login, ip) >= LOGIN_FAIL_MAX) {
    logAudit({ action: "login.lock", login, ip, userAgent });
  }
  return { error: "Невірний логін або пароль." };
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
