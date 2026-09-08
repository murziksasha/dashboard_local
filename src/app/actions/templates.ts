"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  createIssueTemplate,
  deleteIssueTemplate,
  seedBuiltinTemplates,
} from "@/lib/issue-templates";
import { createRecurring, deleteRecurring } from "@/lib/recurring";
import { canEditIssues, canManageProject } from "@/lib/permissions";
import type { IssueType, Priority } from "@/lib/types";

export async function createTemplateAction(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") || "");
  if (!canManageProject(user, projectId)) throw new Error("FORBIDDEN");
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Назва шаблону обовʼязкова." };
  createIssueTemplate({
    projectId,
    name,
    type: (String(formData.get("type") || "task") as IssueType) || "task",
    title: String(formData.get("title") || "") || null,
    description: String(formData.get("description") || "") || null,
    priority: (String(formData.get("priority") || "medium") as Priority) || "medium",
    labels: String(formData.get("labels") || "") || null,
  });
  revalidatePath(`/projects/${projectId}/settings`);
  return { ok: true as const };
}

export async function deleteTemplateAction(id: string, projectId: string) {
  const user = await requireUser();
  if (!canManageProject(user, projectId)) throw new Error("FORBIDDEN");
  deleteIssueTemplate(id);
  revalidatePath(`/projects/${projectId}/settings`);
  return { ok: true as const };
}

export async function seedTemplatesAction(projectId: string) {
  const user = await requireUser();
  if (!canManageProject(user, projectId)) throw new Error("FORBIDDEN");
  seedBuiltinTemplates(projectId);
  revalidatePath(`/projects/${projectId}/settings`);
  return { ok: true as const };
}

export async function createRecurringAction(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") || "");
  if (!canEditIssues(user, projectId)) throw new Error("FORBIDDEN");
  const title = String(formData.get("title") || "").trim();
  if (!title) return { error: "Заголовок обовʼязковий." };
  const frequency = String(formData.get("frequency") || "weekly");
  if (frequency !== "daily" && frequency !== "weekly" && frequency !== "monthly") {
    return { error: "Невірна частота." };
  }
  createRecurring({
    projectId,
    title,
    description: String(formData.get("description") || "") || null,
    type: (String(formData.get("type") || "task") as IssueType) || "task",
    priority: (String(formData.get("priority") || "medium") as Priority) || "medium",
    frequency,
    createdBy: user.id,
  });
  revalidatePath(`/projects/${projectId}/settings`);
  return { ok: true as const };
}

export async function deleteRecurringAction(id: string, projectId: string) {
  const user = await requireUser();
  if (!canManageProject(user, projectId)) throw new Error("FORBIDDEN");
  deleteRecurring(id);
  revalidatePath(`/projects/${projectId}/settings`);
  return { ok: true as const };
}
