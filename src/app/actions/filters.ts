"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { nowIso, run } from "@/lib/db";
import { createId } from "@/lib/id";
import { assertMinRole } from "@/lib/permissions";

export async function saveFilterAction(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") || "") || null;
  const name = String(formData.get("name") || "").trim();
  const queryJson = String(formData.get("queryJson") || "{}");
  const shared = formData.get("shared") === "on" ? 1 : 0;
  if (!name) return { error: "Назва фільтра обовʼязкова." };
  if (projectId) assertMinRole(user, projectId, "viewer");
  run(
    `INSERT INTO saved_filters (id, owner_id, project_id, name, query_json, shared, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [createId("flt"), user.id, projectId, name, queryJson, shared, nowIso()],
  );
  if (projectId) revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteFilterAction(filterId: string, projectId?: string) {
  const user = await requireUser();
  run(`DELETE FROM saved_filters WHERE id = ? AND owner_id = ?`, [
    filterId,
    user.id,
  ]);
  if (projectId) revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}
