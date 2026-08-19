"use server";

import { revalidatePath } from "next/cache";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { get, nowIso, run } from "@/lib/db";
import { createId } from "@/lib/id";

export async function createUserAction(formData: FormData) {
  await requireAdmin();
  const login = String(formData.get("login") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim() || null;
  const password = String(formData.get("password") || "");
  const globalRole = String(formData.get("global_role") || "user");

  if (!login || !name || password.length < 6) {
    return { error: "Логін, імʼя та пароль (мін. 6) обовʼязкові." };
  }
  if (get(`SELECT id FROM users WHERE login = ? COLLATE NOCASE`, [login])) {
    return { error: "Логін уже зайнятий." };
  }

  const id = createId("usr");
  const ts = nowIso();
  run(
    `INSERT INTO users (id, login, name, email, password_hash, global_role, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [
      id,
      login,
      name,
      email,
      hashPassword(password),
      globalRole === "admin" ? "admin" : "user",
      ts,
      ts,
    ],
  );
  revalidatePath("/admin/users");
  return { ok: true as const };
}

export async function toggleUserActiveAction(userId: string, active: boolean) {
  const admin = await requireAdmin();
  if (admin.id === userId && !active) {
    return { error: "Не можна деактивувати самого себе." };
  }
  run(`UPDATE users SET active = ?, updated_at = ? WHERE id = ?`, [
    active ? 1 : 0,
    nowIso(),
    userId,
  ]);
  revalidatePath("/admin/users");
  return { ok: true as const };
}

export async function resetPasswordAction(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") || "");
  const password = String(formData.get("password") || "");
  if (password.length < 6) return { error: "Пароль мінімум 6 символів." };
  run(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`, [
    hashPassword(password),
    nowIso(),
    userId,
  ]);
  revalidatePath("/admin/users");
  return { ok: true as const };
}

export async function createTeamAction(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  if (!name) return { error: "Назва команди обовʼязкова." };
  if (get(`SELECT id FROM teams WHERE name = ? COLLATE NOCASE`, [name])) {
    return { error: "Команда з такою назвою вже є." };
  }
  const id = createId("team");
  run(`INSERT INTO teams (id, name, description, created_at) VALUES (?, ?, ?, ?)`, [
    id,
    name,
    description,
    nowIso(),
  ]);
  const members = formData.getAll("members").map(String);
  for (const userId of members) {
    run(`INSERT OR IGNORE INTO team_members (team_id, user_id) VALUES (?, ?)`, [
      id,
      userId,
    ]);
  }
  revalidatePath("/admin/teams");
  revalidatePath("/teams");
  return { ok: true as const };
}

export async function addTeamMemberAction(teamId: string, userId: string) {
  await requireAdmin();
  run(`INSERT OR IGNORE INTO team_members (team_id, user_id) VALUES (?, ?)`, [
    teamId,
    userId,
  ]);
  revalidatePath("/admin/teams");
}

export async function removeTeamMemberAction(teamId: string, userId: string) {
  await requireAdmin();
  run(`DELETE FROM team_members WHERE team_id = ? AND user_id = ?`, [
    teamId,
    userId,
  ]);
  revalidatePath("/admin/teams");
}
