"use server";

import { redirect } from "next/navigation";
import {
  createSession,
  destroySession,
  hashPassword,
  isSetupComplete,
  ldapPasswordPlaceholder,
  verifyPassword,
} from "@/lib/auth";
import { get, nowIso, run, settingSet } from "@/lib/db";
import { createId } from "@/lib/id";
import { isLdapEnabled, ldapAuthenticate } from "@/lib/ldap";
import { seedDemo } from "@/lib/seed";
import type { SessionUser } from "@/lib/types";

export async function setupAction(formData: FormData) {
  if (isSetupComplete()) redirect("/login");

  const name = String(formData.get("name") || "").trim();
  const login = String(formData.get("login") || "").trim();
  const password = String(formData.get("password") || "");
  const appName = String(formData.get("appName") || "Dashboard Local").trim();
  const withDemo = formData.get("demo") === "on";

  if (!name || !login || password.length < 6) {
    return { error: "Заповніть імʼя, логін і пароль (мін. 6 символів)." };
  }

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
  const login = String(formData.get("login") || "").trim();
  const password = String(formData.get("password") || "");

  const local = get<{
    id: string;
    password_hash: string;
    active: number;
  }>(
    `SELECT id, password_hash, active FROM users WHERE login = ? COLLATE NOCASE`,
    [login],
  );

  if (local?.active && verifyPassword(password, local.password_hash)) {
    await createSession(local.id);
    redirect("/dashboard");
  }

  if (isLdapEnabled()) {
    const profile = await ldapAuthenticate(login, password);
    if (profile) {
      try {
        const userId = await ensureLdapUser(profile);
        await createSession(userId);
        redirect("/dashboard");
      } catch {
        return { error: "Обліковий запис вимкнено." };
      }
    }
  }

  return { error: "Невірний логін або пароль." };
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
