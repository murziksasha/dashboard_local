"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { settingSet } from "@/lib/db";

export async function updateAppNameAction(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("app_name") || "").trim();
  if (!name) return { error: "Назва не може бути порожньою." };
  settingSet("app_name", name);
  revalidatePath("/");
  return { ok: true as const };
}
