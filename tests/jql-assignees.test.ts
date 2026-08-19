import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("jql and multi-assignee", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dl-jql-"));
    process.env.DASHBOARD_DATA_DIR = tempDir;
    process.env.DASHBOARD_DB_PATH = path.join(tempDir, "test.db");
  });

  afterEach(async () => {
    const { resetDbConnection } = await import("../src/lib/db");
    resetDbConnection();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  async function bootAdmin() {
    const db = await import("../src/lib/db");
    db.resetDbConnection();
    db.getDb();
    const { hashPassword } = await import("../src/lib/auth");
    const { createId } = await import("../src/lib/id");
    const { createProject } = await import("../src/lib/projects");
    const { createIssue } = await import("../src/lib/issues");
    const { getIssueAssignees } = await import("../src/lib/assignees");

    const adminId = createId("usr");
    const u2 = createId("usr");
    const ts = db.nowIso();
    db.run(
      `INSERT INTO users (id, login, name, email, password_hash, global_role, active, created_at, updated_at)
       VALUES (?, 'admin', 'Admin', NULL, ?, 'admin', 1, ?, ?)`,
      [adminId, hashPassword("secret12"), ts, ts],
    );
    db.run(
      `INSERT INTO users (id, login, name, email, password_hash, global_role, active, created_at, updated_at)
       VALUES (?, 'alice', 'Alice', NULL, ?, 'user', 1, ?, ?)`,
      [u2, hashPassword("secret12"), ts, ts],
    );
    const actor = {
      id: adminId,
      login: "admin",
      name: "Admin",
      email: null,
      global_role: "admin" as const,
    };
    const project = createProject({
      key: "JQL",
      name: "JQL",
      leadId: adminId,
      actor,
      memberIds: [u2],
    });
    const bug = createIssue({
      projectId: project.id,
      type: "bug",
      title: "Broken firewall rule",
      reporterId: adminId,
      assigneeIds: [adminId, u2],
      labels: ["net"],
      actor,
    });
    const task = createIssue({
      projectId: project.id,
      type: "task",
      title: "Docs",
      reporterId: adminId,
      actor,
    });
    return { db, project, actor, adminId, u2, bug, task, getIssueAssignees };
  }

  it("stores multiple assignees", async () => {
    const { bug, getIssueAssignees } = await bootAdmin();
    const assignees = getIssueAssignees(bug.id);
    expect(assignees.map((a) => a.login).sort()).toEqual(["admin", "alice"]);
  });

  it("filters with practical JQL", async () => {
    const { project, adminId, runJql } = {
      ...(await bootAdmin()),
      runJql: (await import("../src/lib/jql")).runJql,
    };
    const bugs = runJql(project.id, "type = bug AND text ~ firewall", adminId);
    expect(bugs.error).toBeUndefined();
    expect(bugs.issues.length).toBe(1);
    expect(bugs.issues[0].key).toBe("JQL-1");

    const byAssignee = runJql(project.id, "assignee = alice", adminId);
    expect(byAssignee.issues.some((i) => i.key === "JQL-1")).toBe(true);

    const ordered = runJql(project.id, "ORDER BY key DESC", adminId);
    expect(ordered.issues[0].key).toBe("JQL-2");
  });
});
