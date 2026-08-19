import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("jql history and custom fields", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dl-hist-"));
    process.env.DASHBOARD_DATA_DIR = tempDir;
    process.env.DASHBOARD_DB_PATH = path.join(tempDir, "test.db");
  });

  afterEach(async () => {
    const { resetDbConnection } = await import("../src/lib/db");
    resetDbConnection();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("supports status WAS/CHANGED and cf[Name]", async () => {
    const db = await import("../src/lib/db");
    db.resetDbConnection();
    db.getDb();
    const { hashPassword } = await import("../src/lib/auth");
    const { createId } = await import("../src/lib/id");
    const { createProject, listStatuses } = await import("../src/lib/projects");
    const { createIssue, moveIssue } = await import("../src/lib/issues");
    const { runJql } = await import("../src/lib/jql");

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
      key: "HX",
      name: "HX",
      leadId: adminId,
      actor,
    });
    const statuses = listStatuses(project.id);
    const todo = statuses.find((s) => s.name === "To Do")!;
    const done = statuses.find((s) => s.name === "Done")!;

    const fieldId = createId("cfd");
    db.run(
      `INSERT INTO custom_field_defs (id, project_id, name, field_type, options_json, required, position)
       VALUES (?, ?, 'Risk', 'select', ?, 0, 0)`,
      [fieldId, project.id, JSON.stringify(["low", "high"])],
    );

    const issue = createIssue({
      projectId: project.id,
      type: "task",
      title: "Tracked",
      reporterId: adminId,
      statusId: todo.id,
      actor,
    });
    db.run(
      `INSERT INTO custom_field_values (field_id, issue_id, value) VALUES (?, ?, 'high')`,
      [fieldId, issue.id],
    );

    moveIssue({ issueId: issue.id, statusId: done.id, actor });

    const was = runJql(project.id, 'status WAS "To Do"', adminId);
    expect(was.issues.some((i) => i.id === issue.id)).toBe(true);

    const changed = runJql(project.id, "status CHANGED AFTER -1d", adminId);
    expect(changed.issues.some((i) => i.id === issue.id)).toBe(true);

    const cf = runJql(project.id, "cf[Risk] = high", adminId);
    expect(cf.issues.some((i) => i.id === issue.id)).toBe(true);
  });
});
