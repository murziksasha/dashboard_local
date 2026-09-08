import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("CSV export / import", () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dl-csv-"));
    process.env.DASHBOARD_DATA_DIR = tempDir;
    process.env.DASHBOARD_DB_PATH = path.join(tempDir, "test.db");
  });
  afterEach(async () => {
    const { resetDbConnection } = await import("../src/lib/db");
    resetDbConnection();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("escapes formulas and round-trips import", async () => {
    const db = await import("../src/lib/db");
    db.resetDbConnection();
    db.getDb();
    const { hashPassword } = await import("../src/lib/auth");
    const { createId } = await import("../src/lib/id");
    const { createProject } = await import("../src/lib/projects");
    const { createIssue } = await import("../src/lib/issues");
    const { issuesToCsv } = await import("../src/lib/backup");
    const { importIssuesFromCsv } = await import("../src/lib/issue-import");
    const adminId = createId("usr");
    const ts = db.nowIso();
    db.run(
      `INSERT INTO users (id, login, name, email, password_hash, global_role, active, created_at, updated_at)
       VALUES (?, 'admin', 'Admin', NULL, ?, 'admin', 1, ?, ?)`,
      [adminId, hashPassword("secret12"), ts, ts],
    );
    const actor = {
      id: adminId,
      login: "admin",
      name: "Admin",
      email: null,
      global_role: "admin" as const,
    };
    const project = createProject({ key: "CSV", name: "Csv", leadId: adminId, actor });
    createIssue({
      projectId: project.id,
      type: "task",
      title: "=HYPERLINK(\"http://evil\")",
      reporterId: adminId,
      actor,
    });
    const csv = issuesToCsv(project.id);
    expect(csv).toContain("'=HYPERLINK");
    const result = importIssuesFromCsv({
      projectId: project.id,
      csv: "title,type,priority\nImported bug,bug,high\n",
      actor,
    });
    expect(result.created).toBe(1);
  });
});
