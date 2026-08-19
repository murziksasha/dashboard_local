"use server";

import { revalidatePath } from "next/cache";
import {
  hashPassword,
  requireUser,
  verifyPassword,
} from "@/lib/auth";
import { get, nowIso, run } from "@/lib/db";

export async function updateProfileAction(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim() || null;
  if (!name) return { error: "Імʼя обовʼязкове." };
  run(`UPDATE users SET name = ?, email = ?, updated_at = ? WHERE id = ?`, [
    name,
    email,
    nowIso(),
    user.id,
  ]);
  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function changeOwnPasswordAction(formData: FormData) {
  const user = await requireUser();
  const current = String(formData.get("current_password") || "");
  const next = String(formData.get("new_password") || "");
  const confirm = String(formData.get("confirm_password") || "");
  if (next.length < 6) return { error: "Новий пароль мінімум 6 символів." };
  if (next !== confirm) return { error: "Паролі не збігаються." };

  const row = get<{ password_hash: string }>(
    `SELECT password_hash FROM users WHERE id = ?`,
    [user.id],
  );
  if (!row || !verifyPassword(current, row.password_hash)) {
    return { error: "Поточний пароль невірний." };
  }
  run(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`, [
    hashPassword(next),
    nowIso(),
    user.id,
  ]);
  return { ok: true as const };
}
