import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach } from "vitest";

let tempDir: string;

export function setupTestDb() {
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dl-test-"));
    process.env.DASHBOARD_DATA_DIR = tempDir;
    process.env.DASHBOARD_DB_PATH = path.join(tempDir, "test.db");
    // reset module singleton by dynamic import pattern — callers import resetDbConnection
  });

  afterEach(async () => {
    const { resetDbConnection } = await import("../src/lib/db");
    resetDbConnection();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });
}

export async function getFreshDb() {
  const { resetDbConnection, getDb } = await import("../src/lib/db");
  resetDbConnection();
  return getDb();
}
