import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("dashboard counts", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dl-dash-"));
    process.env.DASHBOARD_DATA_DIR = tempDir;
    process.env.DASHBOARD_DB_PATH = path.join(tempDir, "test.db");
  });

  afterEach(async () => {
    const { resetDbConnection } = await import("../src/lib/db");
    resetDbConnection();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  async function boot() {
    const db = await import("../src/lib/db");
    db.resetDbConnection();
    db.getDb();
    const { hashPassword } = await import("../src/lib/auth");
    const { createId } = await import("../src/lib/id");
    const { createProject } = await import("../src/lib/projects");
    const { createIssue } = await import("../src/lib/issues");
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
    const project = createProject({
      key: "CNT",
      name: "Counts",
      leadId: adminId,
      actor,
    });
    for (let i = 0; i < 15; i++) {
      createIssue({
        projectId: project.id,
        type: "task",
        title: `Task ${i}`,
        reporterId: adminId,
        assigneeIds: [adminId],
        dueDate: i < 3 ? "2000-01-01" : null,
        actor,
      });
    }
    return { actor, project };
  }

  it("counts all open assignments, not the widget LIMIT", async () => {
    const { actor } = await boot();
    const { countAssignedOpen, countAssignedOverdue } = await import(
      "../src/lib/dashboard-queries"
    );
    expect(countAssignedOpen(actor.id)).toBe(15);
    expect(countAssignedOverdue(actor.id)).toBe(3);
  });
});
