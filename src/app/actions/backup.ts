"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createBackup, listBackups, restoreBackup } from "@/lib/backup";

export async function createBackupAction() {
  await requireAdmin();
  const name = createBackup("manual");
  revalidatePath("/admin/backups");
  return { ok: true as const, name };
}

export async function listBackupsAction() {
  await requireAdmin();
  return listBackups();
}

export async function restoreBackupAction(filename: string) {
  await requireAdmin();
  restoreBackup(filename);
  revalidatePath("/");
}
