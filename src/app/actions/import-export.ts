"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { importIssuesFromCsv } from "@/lib/issue-import";
import { canEditIssues } from "@/lib/permissions";

export async function importCsvAction(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") || "");
  if (!canEditIssues(user, projectId)) throw new Error("FORBIDDEN");
  const file = formData.get("file");
  let csv = String(formData.get("csv") || "");
  if (file instanceof File && file.size) {
    csv = await file.text();
  }
  if (!csv.trim()) return { error: "Порожній файл." };
  const result = importIssuesFromCsv({ projectId, csv, actor: user });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/list`);
  return { ok: true as const, ...result };
}
