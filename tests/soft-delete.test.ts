import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("soft-delete and WIP", () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dl-sd-"));
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
    const { createProject, listStatuses } = await import("../src/lib/projects");
    const { createIssue, getIssue, listIssues, moveIssue } = await import("../src/lib/issues");
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
    const project = createProject({ key: "DEL", name: "Del", leadId: adminId, actor });
    return { db, actor, project, createIssue, getIssue, listIssues, moveIssue, listStatuses };
  }

  it("hides soft-deleted issues from lists", async () => {
    const { db, actor, project, createIssue, getIssue, listIssues } = await boot();
    const issue = createIssue({
      projectId: project.id,
      type: "task",
      title: "Gone",
      reporterId: actor.id,
      actor,
    });
    db.run(`UPDATE issues SET deleted_at = ? WHERE id = ?`, [db.nowIso(), issue.id]);
    expect(getIssue(issue.id)).toBeUndefined();
    expect(listIssues(project.id).map((i) => i.id)).not.toContain(issue.id);
  });

  it("blocks move when WIP limit is reached", async () => {
    const { actor, project, createIssue, moveIssue, listStatuses } = await boot();
    const review = listStatuses(project.id).find((s) => s.name === "Review")!;
    const { run } = await import("../src/lib/db");
    run(`UPDATE statuses SET wip_limit = 1 WHERE id = ?`, [review.id]);
    const a = createIssue({
      projectId: project.id,
      type: "task",
      title: "A",
      reporterId: actor.id,
      actor,
    });
    const b = createIssue({
      projectId: project.id,
      type: "task",
      title: "B",
      reporterId: actor.id,
      actor,
    });
    moveIssue({ issueId: a.id, statusId: review.id, actor });
    expect(() => moveIssue({ issueId: b.id, statusId: review.id, actor })).toThrow(/WIP/);
  });
});
