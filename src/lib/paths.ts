import path from "path";

export function getDataDir() {
  return process.env.DASHBOARD_DATA_DIR || path.join(process.cwd(), "data");
}

export function getDbPath() {
  return (
    process.env.DASHBOARD_DB_PATH || path.join(getDataDir(), "dashboard.db")
  );
}

export function getUploadsDir() {
  return path.join(getDataDir(), "uploads");
}

export function getBackupsDir() {
  return path.join(getDataDir(), "backups");
}

/** @deprecated prefer getters — kept for gradual migration */
export const DATA_DIR = path.join(process.cwd(), "data");
export const DB_PATH = path.join(DATA_DIR, "dashboard.db");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
export const BACKUPS_DIR = path.join(DATA_DIR, "backups");

export function getListenPort(): number {
  const raw = process.env.PORT || "3000";
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 3000;
}
