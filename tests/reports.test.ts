import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("sprint reports and time", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dl-rep-"));
    process.env.DASHBOARD_DATA_DIR = tempDir;
    process.env.DASHBOARD_DB_PATH = path.join(tempDir, "test.db");
  });

  afterEach(async () => {
    const { resetDbConnection } = await import("../src/lib/db");
    resetDbConnection();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("snapshots remaining points and records velocity on close", async () => {
    const db = await import("../src/lib/db");
    db.resetDbConnection();
    db.getDb();
    const { hashPassword } = await import("../src/lib/auth");
    const { createId } = await import("../src/lib/id");
    const { createProject, listStatuses } = await import("../src/lib/projects");
    const { createIssue, moveIssue } = await import("../src/lib/issues");
    const reports = await import("../src/lib/reports");
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
    const project = createProject({ key: "REP", name: "Reports", leadId: adminId, actor });
    const sprintId = createId("spr");
    db.run(
      `INSERT INTO sprints (id, project_id, name, goal, start_date, end_date, status, created_at)
       VALUES (?, ?, 'S1', NULL, date('now'), date('now', '+14 day'), 'active', ?)`,
      [sprintId, project.id, ts],
    );
    const a = createIssue({
      projectId: project.id,
      type: "task",
      title: "A",
      reporterId: adminId,
      sprintId,
      storyPoints: 5,
      actor,
    });
    createIssue({
      projectId: project.id,
      type: "task",
      title: "B",
      reporterId: adminId,
      sprintId,
      storyPoints: 3,
      actor,
    });
    reports.recordSprintCommit(sprintId);
    const done = listStatuses(project.id).find((s) => s.name === "Done")!;
    moveIssue({ issueId: a.id, statusId: done.id, actor });
    reports.recordSprintComplete(sprintId);
    db.run(`UPDATE sprints SET status = 'closed' WHERE id = ?`, [sprintId]);

    const burn = reports.getBurndown(sprintId);
    expect(burn.committed_points).toBe(8);
    expect(burn.points.length).toBeGreaterThan(0);
    const vel = reports.getVelocity(project.id);
    expect(vel[0]?.completed_points).toBe(5);
  });

  it("sums worklogs by user and skips deleted issues", async () => {
    const db = await import("../src/lib/db");
    db.resetDbConnection();
    db.getDb();
    const { hashPassword } = await import("../src/lib/auth");
    const { createId } = await import("../src/lib/id");
    const { createProject } = await import("../src/lib/projects");
    const { createIssue } = await import("../src/lib/issues");
    const reports = await import("../src/lib/reports");
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
    const project = createProject({ key: "TIME", name: "Time", leadId: adminId, actor });
    const live = createIssue({
      projectId: project.id,
      type: "task",
      title: "Live",
      reporterId: adminId,
      actor,
    });
    const gone = createIssue({
      projectId: project.id,
      type: "task",
      title: "Gone",
      reporterId: adminId,
      actor,
    });
    db.run(
      `INSERT INTO worklogs (id, issue_id, user_id, seconds, work_date, note, created_at)
       VALUES (?, ?, ?, 3600, date('now'), NULL, ?)`,
      [createId("wl"), live.id, adminId, ts],
    );
    db.run(
      `INSERT INTO worklogs (id, issue_id, user_id, seconds, work_date, note, created_at)
       VALUES (?, ?, ?, 7200, date('now'), NULL, ?)`,
      [createId("wl"), gone.id, adminId, ts],
    );
    db.run(`UPDATE issues SET deleted_at = ? WHERE id = ?`, [ts, gone.id]);
    const report = reports.getTimeReport(project.id, "2000-01-01", "2099-01-01");
    expect(report.totalSeconds).toBe(3600);
    expect(report.byUser[0]?.entries).toBe(1);
  });
});
