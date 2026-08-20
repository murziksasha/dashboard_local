import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("assignee filter and assignable users", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dl-asgn-"));
    process.env.DASHBOARD_DATA_DIR = tempDir;
    process.env.DASHBOARD_DB_PATH = path.join(tempDir, "test.db");
  });

  afterEach(async () => {
    const { resetDbConnection } = await import("../src/lib/db");
    resetDbConnection();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("filters by secondary assignee and unassigned", async () => {
    const db = await import("../src/lib/db");
    db.resetDbConnection();
    db.getDb();
    const { hashPassword } = await import("../src/lib/auth");
    const { createId } = await import("../src/lib/id");
    const { createProject } = await import("../src/lib/projects");
    const { createIssue, listIssues } = await import("../src/lib/issues");
    const adminId = createId("usr");
    const aliceId = createId("usr");
    const outsiderId = createId("usr");
    const ts = db.nowIso();
    for (const [id, login, name, role] of [
      [adminId, "admin", "Admin", "admin"],
      [aliceId, "alice", "Alice", "user"],
      [outsiderId, "bob", "Bob", "user"],
    ] as const) {
      db.run(
        `INSERT INTO users (id, login, name, email, password_hash, global_role, active, created_at, updated_at)
         VALUES (?, ?, ?, NULL, ?, ?, 1, ?, ?)`,
        [id, login, name, hashPassword("secret12"), role, ts, ts],
      );
    }
    const actor = {
      id: adminId,
      login: "admin",
      name: "Admin",
      email: null,
      global_role: "admin" as const,
    };
    const project = createProject({
      key: "ASG",
      name: "Assign",
      leadId: adminId,
      actor,
      memberIds: [aliceId],
    });
    createIssue({
      projectId: project.id,
      type: "task",
      title: "Shared",
      reporterId: adminId,
      assigneeIds: [adminId, aliceId],
      actor,
    });
    createIssue({
      projectId: project.id,
      type: "task",
      title: "Nobody",
      reporterId: adminId,
      actor,
    });

    const forAlice = listIssues(project.id, { assigneeIds: [aliceId] });
    expect(forAlice.map((i) => i.title)).toEqual(["Shared"]);
    expect(forAlice[0].assignee_names).toContain("Alice");
    expect(forAlice[0].assignee_names).toContain("Admin");

    const none = listIssues(project.id, { assigneeIds: ["unassigned"] });
    expect(none.map((i) => i.title)).toEqual(["Nobody"]);

    const { listProjectAssignableUsers } = await import("../src/lib/projects");
    const assignable = listProjectAssignableUsers(project.id).map((u) => u.login);
    expect(assignable.sort()).toEqual(["admin", "alice"]);
    expect(assignable).not.toContain("bob");
  });

  it("includes team members in assignable users and recent issues", async () => {
    const db = await import("../src/lib/db");
    db.resetDbConnection();
    db.getDb();
    const { hashPassword } = await import("../src/lib/auth");
    const { createId } = await import("../src/lib/id");
    const { createProject, listProjectAssignableUsers } = await import(
      "../src/lib/projects"
    );
    const { createIssue } = await import("../src/lib/issues");
    const adminId = createId("usr");
    const carolId = createId("usr");
    const ts = db.nowIso();
    db.run(
      `INSERT INTO users (id, login, name, email, password_hash, global_role, active, created_at, updated_at)
       VALUES (?, 'admin', 'Admin', NULL, ?, 'admin', 1, ?, ?)`,
      [adminId, hashPassword("secret12"), ts, ts],
    );
    db.run(
      `INSERT INTO users (id, login, name, email, password_hash, global_role, active, created_at, updated_at)
       VALUES (?, 'carol', 'Carol', NULL, ?, 'user', 1, ?, ?)`,
      [carolId, hashPassword("secret12"), ts, ts],
    );
    const actor = {
      id: adminId,
      login: "admin",
      name: "Admin",
      email: null,
      global_role: "admin" as const,
    };
    const project = createProject({
      key: "TM",
      name: "Team",
      leadId: adminId,
      actor,
    });
    const teamId = createId("tm");
    db.run(`INSERT INTO teams (id, name, description, created_at) VALUES (?, 'Dev', NULL, ?)`, [
      teamId,
      ts,
    ]);
    db.run(`INSERT INTO team_members (team_id, user_id) VALUES (?, ?)`, [teamId, carolId]);
    db.run(
      `INSERT INTO project_teams (project_id, team_id, role) VALUES (?, ?, 'member')`,
      [project.id, teamId],
    );
    createIssue({
      projectId: project.id,
      type: "task",
      title: "Via team",
      reporterId: adminId,
      actor,
    });

    const assignable = listProjectAssignableUsers(project.id).map((u) => u.login);
    expect(assignable).toContain("carol");

    const carol = {
      id: carolId,
      login: "carol",
      name: "Carol",
      email: null,
      global_role: "user" as const,
    };
    const { listRecentIssuesForUser } = await import("../src/lib/dashboard-queries");
    const recent = listRecentIssuesForUser(carol, 10);
    expect(recent.map((i) => i.title)).toContain("Via team");
  });
});
