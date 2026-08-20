import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("backup uploads snapshot", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dl-bk-"));
    process.env.DASHBOARD_DATA_DIR = tempDir;
    process.env.DASHBOARD_DB_PATH = path.join(tempDir, "test.db");
  });

  afterEach(async () => {
    const { resetDbConnection } = await import("../src/lib/db");
    resetDbConnection();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("copies uploads next to the db dump and restores them", async () => {
    const db = await import("../src/lib/db");
    db.resetDbConnection();
    db.getDb();
    const uploads = path.join(tempDir, "uploads", "prj_x");
    fs.mkdirSync(uploads, { recursive: true });
    fs.writeFileSync(path.join(uploads, "hello.txt"), "payload");

    const { createBackup, restoreBackup, listBackups } = await import("../src/lib/backup");
    const name = createBackup("test");
    const listed = listBackups();
    expect(listed[0]?.name).toBe(name);
    expect(listed[0]?.uploadsSize).toBeGreaterThan(0);

    fs.rmSync(path.join(tempDir, "uploads"), { recursive: true, force: true });
    expect(fs.existsSync(path.join(tempDir, "uploads", "prj_x", "hello.txt"))).toBe(false);

    restoreBackup(name);
    expect(fs.readFileSync(path.join(tempDir, "uploads", "prj_x", "hello.txt"), "utf8")).toBe(
      "payload",
    );
  });
});
