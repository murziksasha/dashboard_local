import fs from "fs";
import path from "path";
import { getBackupsDir, getDbPath } from "./paths";
import { all, getDb, resetDbConnection, settingGet, settingSet } from "./db";

export function createBackup(label = "manual"): string {
  const backupsDir = getBackupsDir();
  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `dashboard-${label}-${stamp}.db`;
  const target = path.join(backupsDir, filename);
  try {
    getDb().exec("PRAGMA wal_checkpoint(TRUNCATE);");
  } catch {
    // ignore
  }
  fs.copyFileSync(getDbPath(), target);
  settingSet("last_backup_at", new Date().toISOString());
  return filename;
}

export function listBackups(): Array<{ name: string; size: number; mtime: string }> {
  const backupsDir = getBackupsDir();
  if (!fs.existsSync(backupsDir)) return [];
  return fs
    .readdirSync(backupsDir)
    .filter((f) => f.endsWith(".db"))
    .map((name) => {
      const st = fs.statSync(path.join(backupsDir, name));
      return {
        name,
        size: st.size,
        mtime: st.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.mtime.localeCompare(a.mtime));
}

export function restoreBackup(filename: string) {
  const src = path.join(getBackupsDir(), path.basename(filename));
  if (!fs.existsSync(src)) throw new Error("BACKUP_NOT_FOUND");
  getDb().exec("PRAGMA wal_checkpoint(TRUNCATE);");
  fs.copyFileSync(src, getDbPath());
  resetDbConnection();
}

export function maybeAutoBackup() {
  const last = settingGet("last_backup_at");
  const now = Date.now();
  if (last) {
    const prev = new Date(last).getTime();
    if (now - prev < 20 * 60 * 60 * 1000) return null; // ~daily
  }
  return createBackup("auto");
}

export function issuesToCsv(projectId: string): string {
  const rows = all<Record<string, unknown>>(
    `SELECT i.key, i.type, i.title, i.priority, s.name as status,
            au.name as assignee, i.due_date, i.story_points, i.created_at, i.updated_at
     FROM issues i
     JOIN statuses s ON s.id = i.status_id
     LEFT JOIN users au ON au.id = i.assignee_id
     WHERE i.project_id = ?
     ORDER BY i.key`,
    [projectId],
  );
  const header = [
    "key",
    "type",
    "title",
    "priority",
    "status",
    "assignee",
    "due_date",
    "story_points",
    "created_at",
    "updated_at",
  ];
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [
    header.join(","),
    ...rows.map((r) => header.map((h) => escape(r[h])).join(",")),
  ].join("\n");
}
