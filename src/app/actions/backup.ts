"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { createBackup, listBackups, restoreBackup } from "@/lib/backup";
import { clientIpFromHeaders } from "@/lib/request-ip";

export async function createBackupAction() {
  const user = await requireAdmin();
  const name = createBackup("manual");
  const h = await headers();
  logAudit({
    action: "backup.create",
    userId: user.id,
    login: user.login,
    ip: clientIpFromHeaders(h),
    detail: name,
  });
  revalidatePath("/admin/backups");
  return { ok: true as const, name };
}

export async function listBackupsAction() {
  await requireAdmin();
  return listBackups();
}

export async function restoreBackupAction(filename: string) {
  const user = await requireAdmin();
  restoreBackup(filename);
  const h = await headers();
  logAudit({
    action: "backup.restore",
    userId: user.id,
    login: user.login,
    ip: clientIpFromHeaders(h),
    detail: filename,
  });
  revalidatePath("/");
}
