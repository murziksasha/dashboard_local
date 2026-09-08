"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/lib/auth";
import { canManageProject } from "@/lib/permissions";
import { encryptSecret } from "@/lib/secrets";
import {
  createWebhook,
  deleteWebhook,
  listWebhooks,
  setWebhookEnabled,
} from "@/lib/webhooks";

export async function createWebhookAction(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") || "") || null;
  if (projectId) {
    if (!canManageProject(user, projectId) && user.global_role !== "admin") {
      throw new Error("FORBIDDEN");
    }
  } else {
    await requireAdmin();
  }
  const url = String(formData.get("url") || "").trim();
  if (!/^https?:\/\//i.test(url)) return { error: "URL має починатися з http(s)://" };
  const secret = String(formData.get("secret") || "").trim();
  const events = String(formData.get("events") || "*").trim() || "*";
  createWebhook({
    url,
    projectId,
    secret: secret ? encryptSecret(secret) : null,
    events,
  });
  if (projectId) revalidatePath(`/projects/${projectId}/settings`);
  else revalidatePath("/admin/settings");
  return { ok: true as const };
}

export async function deleteWebhookAction(id: string, projectId?: string) {
  const user = await requireUser();
  if (projectId) {
    if (!canManageProject(user, projectId) && user.global_role !== "admin") {
      throw new Error("FORBIDDEN");
    }
  } else {
    await requireAdmin();
  }
  deleteWebhook(id);
  if (projectId) revalidatePath(`/projects/${projectId}/settings`);
  else revalidatePath("/admin/settings");
  return { ok: true as const };
}

export async function toggleWebhookAction(id: string, enabled: boolean, projectId?: string) {
  await requireAdmin();
  setWebhookEnabled(id, enabled);
  if (projectId) revalidatePath(`/projects/${projectId}/settings`);
  else revalidatePath("/admin/settings");
  return { ok: true as const };
}

export async function listWebhooksAction(projectId?: string) {
  await requireAdmin();
  return listWebhooks(projectId);
}
