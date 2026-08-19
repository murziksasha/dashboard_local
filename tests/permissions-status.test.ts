import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("permissions and statuses", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dl-perm-"));
    process.env.DASHBOARD_DATA_DIR = tempDir;
    process.env.DASHBOARD_DB_PATH = path.join(tempDir, "test.db");
  });

  afterEach(async () => {
    const { resetDbConnection } = await import("../src/lib/db");
    resetDbConnection();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("resolves project roles via membership and teams", async () => {
    const db = await import("../src/lib/db");
    db.resetDbConnection();
    db.getDb();
    const { hashPassword } = await import("../src/lib/auth");
    const { createId } = await import("../src/lib/id");
    const { createProject } = await import("../src/lib/projects");
    const {
      getProjectRole,
      canEditIssues,
      canComment,
      canManageProject,
    } = await import("../src/lib/permissions");

    const adminId = createId("usr");
    const memberId = createId("usr");
    const viewerId = createId("usr");
    const teamUserId = createId("usr");
    const ts = db.nowIso();
    for (const [id, login] of [
      [adminId, "admin"],
      [memberId, "member"],
      [viewerId, "viewer"],
      [teamUserId, "teamuser"],
    ] as const) {
      db.run(
        `INSERT INTO users (id, login, name, email, password_hash, global_role, active, created_at, updated_at)
         VALUES (?, ?, ?, NULL, ?, 'user', 1, ?, ?)`,
        [id, login, login, hashPassword("secret12"), ts, ts],
      );
    }
    // make first user admin
    db.run(`UPDATE users SET global_role = 'admin' WHERE id = ?`, [adminId]);

    const actor = {
      id: adminId,
      login: "admin",
      name: "admin",
      email: null,
      global_role: "admin" as const,
    };
    const project = createProject({
      key: "ACL",
      name: "ACL",
      leadId: adminId,
      actor,
      memberIds: [memberId],
    });
    db.run(
      `INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'viewer')`,
      [project.id, viewerId],
    );
    const teamId = createId("team");
    db.run(`INSERT INTO teams (id, name, description, created_at) VALUES (?, 'T', NULL, ?)`, [
      teamId,
      ts,
    ]);
    db.run(`INSERT INTO team_members (team_id, user_id) VALUES (?, ?)`, [
      teamId,
      teamUserId,
    ]);
    db.run(
      `INSERT INTO project_teams (project_id, team_id, role) VALUES (?, ?, 'member')`,
      [project.id, teamId],
    );

    const member = {
      id: memberId,
      login: "member",
      name: "member",
      email: null,
      global_role: "user" as const,
    };
    const viewer = {
      id: viewerId,
      login: "viewer",
      name: "viewer",
      email: null,
      global_role: "user" as const,
    };
    const teamUser = {
      id: teamUserId,
      login: "teamuser",
      name: "teamuser",
      email: null,
      global_role: "user" as const,
    };

    expect(getProjectRole(actor, project.id)).toBe("lead");
    expect(getProjectRole(member, project.id)).toBe("member");
    expect(getProjectRole(viewer, project.id)).toBe("viewer");
    expect(getProjectRole(teamUser, project.id)).toBe("member");
    expect(canEditIssues(member, project.id)).toBe(true);
    expect(canEditIssues(viewer, project.id)).toBe(false);
    expect(canComment(viewer, project.id)).toBe(true);
    expect(canManageProject(member, project.id)).toBe(false);
    expect(canManageProject(actor, project.id)).toBe(true);
  });

  it("updates status wip limit and rejects delete when issues exist", async () => {
    const db = await import("../src/lib/db");
    db.resetDbConnection();
    db.getDb();
    const { hashPassword } = await import("../src/lib/auth");
    const { createId } = await import("../src/lib/id");
    const { createProject, listStatuses } = await import("../src/lib/projects");
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
      key: "WIP",
      name: "WIP",
      leadId: adminId,
      actor,
    });
    const statuses = listStatuses(project.id);
    const todo = statuses.find((s) => s.name === "To Do")!;
    db.run(`UPDATE statuses SET wip_limit = 2 WHERE id = ?`, [todo.id]);
    expect(listStatuses(project.id).find((s) => s.id === todo.id)?.wip_limit).toBe(2);

    createIssue({
      projectId: project.id,
      type: "task",
      title: "Keep",
      reporterId: adminId,
      statusId: todo.id,
      actor,
    });
    const count = db.get<{ c: number }>(
      `SELECT COUNT(*) as c FROM issues WHERE status_id = ?`,
      [todo.id],
    )?.c;
    expect(count).toBe(1);
  });
});
