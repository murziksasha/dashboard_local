"use server";

import { revalidatePath } from "next/cache";
import { withAction } from "@/lib/action";
import { requireAdmin, requireUser } from "@/lib/auth";
import { canManageProject } from "@/lib/permissions";
import { encryptSecret } from "@/lib/secrets";
import {
  createWebhook,
  deleteWebhook,
  isSafeWebhookUrl,
  listWebhooks,
  setWebhookEnabled,
} from "@/lib/webhooks";

export async function createWebhookAction(formData: FormData) {
  return withAction("createWebhook", async () => {
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
    if (!isSafeWebhookUrl(url)) {
      return { error: "Некоректний або заборонений URL вебхука." };
    }
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
  });
}

export async function deleteWebhookAction(id: string, projectId?: string) {
  return withAction("deleteWebhook", async () => {
    const user = await requireUser();
    if (projectId) {
      if (!canManageProject(user, projectId) && user.global_role !== "admin") {
        throw new Error("FORBIDDEN");
      }
    } else {
      await requireAdmin();
    }
    deleteWebhook(id, projectId || null);
    if (projectId) revalidatePath(`/projects/${projectId}/settings`);
    else revalidatePath("/admin/settings");
    return { ok: true as const };
  });
}

export async function toggleWebhookAction(id: string, enabled: boolean, projectId?: string) {
  return withAction("toggleWebhook", async () => {
    const user = await requireUser();
    if (projectId) {
      if (!canManageProject(user, projectId)) throw new Error("FORBIDDEN");
    } else {
      await requireAdmin();
    }
    setWebhookEnabled(id, enabled, projectId || null);
    if (projectId) revalidatePath(`/projects/${projectId}/settings`);
    else revalidatePath("/admin/settings");
    return { ok: true as const };
  });
}

export async function listWebhooksAction(projectId?: string) {
  await requireAdmin();
  return listWebhooks(projectId);
}
