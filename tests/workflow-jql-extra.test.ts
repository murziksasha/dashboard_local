import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("workflow and extended jql", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dl-wf-"));
    process.env.DASHBOARD_DATA_DIR = tempDir;
    process.env.DASHBOARD_DB_PATH = path.join(tempDir, "test.db");
  });

  afterEach(async () => {
    const { resetDbConnection } = await import("../src/lib/db");
    resetDbConnection();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("blocks transition without assignee when rule requires it", async () => {
    const db = await import("../src/lib/db");
    db.resetDbConnection();
    db.getDb();
    const { hashPassword } = await import("../src/lib/auth");
    const { createId } = await import("../src/lib/id");
    const { createProject, listStatuses } = await import("../src/lib/projects");
    const { createIssue, moveIssue } = await import("../src/lib/issues");
    const { createWorkflowRule } = await import("../src/lib/workflow");

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
      key: "WF",
      name: "WF",
      leadId: adminId,
      actor,
    });
    const statuses = listStatuses(project.id);
    const todo = statuses.find((s) => s.name === "To Do")!;
    const done = statuses.find((s) => s.name === "Done")!;
    createWorkflowRule({
      projectId: project.id,
      name: "Need assignee for Done",
      toStatusId: done.id,
      requireAssignee: true,
    });
    const issue = createIssue({
      projectId: project.id,
      type: "task",
      title: "No assignee",
      reporterId: adminId,
      statusId: todo.id,
      actor,
    });
    expect(() =>
      moveIssue({ issueId: issue.id, statusId: done.id, actor }),
    ).toThrow(/виконавець/i);
  });

  it("supports relative due dates in JQL", async () => {
    const db = await import("../src/lib/db");
    db.resetDbConnection();
    db.getDb();
    const { hashPassword } = await import("../src/lib/auth");
    const { createId } = await import("../src/lib/id");
    const { createProject } = await import("../src/lib/projects");
    const { createIssue } = await import("../src/lib/issues");
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
      key: "REL",
      name: "REL",
      leadId: adminId,
      actor,
    });
    const due = db.all<{ d: string }>(`SELECT date('now', '+2 day') as d`)[0].d;
    createIssue({
      projectId: project.id,
      type: "task",
      title: "Soon",
      reporterId: adminId,
      dueDate: due,
      actor,
    });
    const res = runJql(project.id, "due <= 7d", adminId);
    expect(res.issues.length).toBe(1);

    const emptyAssignees = runJql(project.id, "assignee is empty", adminId);
    expect(emptyAssignees.issues.some((i) => i.key === "REL-1")).toBe(true);

    const notEmpty = runJql(project.id, "assignee is not empty", adminId);
    expect(notEmpty.issues.length).toBe(0);
  });
});
