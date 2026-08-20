import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("data hygiene", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dl-hyg-"));
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
    const { createProject, listProjectOpenCounts } = await import("../src/lib/projects");
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
      key: "HYG",
      name: "Hygiene",
      leadId: adminId,
      actor,
    });
    const issue = createIssue({
      projectId: project.id,
      type: "task",
      title: "Live",
      reporterId: adminId,
      assigneeIds: [adminId],
      dueDate: "2000-01-01",
      actor,
    });
    const gone = createIssue({
      projectId: project.id,
      type: "task",
      title: "Trash",
      reporterId: adminId,
      assigneeIds: [adminId],
      dueDate: "2000-01-01",
      actor,
    });
    db.run(`UPDATE issues SET deleted_at = ? WHERE id = ?`, [db.nowIso(), gone.id]);
    return { db, actor, project, issue, gone, listProjectOpenCounts };
  }

  it("excludes soft-deleted issues from dashboard lists and project counts", async () => {
    const { actor, project, listProjectOpenCounts } = await boot();
    const q = await import("../src/lib/dashboard-queries");
    expect(q.countAssignedOpen(actor.id)).toBe(1);
    expect(q.countAssignedOverdue(actor.id)).toBe(1);
    expect(q.listAssignedOpen(actor.id)).toHaveLength(1);
    expect(q.countProjectIssues(project.id)).toBe(1);
    expect(listProjectOpenCounts([project.id])[project.id]).toBe(1);
    const byStatus = q.issuesByStatus(project.id);
    const total = byStatus.reduce((s, r) => s + Number(r.c), 0);
    expect(total).toBe(1);
  });

  it("CSV skips deleted issues and uses multi-assignee names", async () => {
    const { project } = await boot();
    const { issuesToCsv } = await import("../src/lib/backup");
    const csv = issuesToCsv(project.id);
    expect(csv).toContain("assignees");
    expect(csv).toContain("HYG-1");
    expect(csv).not.toContain("HYG-2");
    expect(csv).toContain("Admin");
  });

  it("hard delete removes attachment files from disk", async () => {
    const { db, actor, project, gone } = await boot();
    const uploads = path.join(tempDir, "uploads", project.id);
    fs.mkdirSync(uploads, { recursive: true });
    const stored = "att_test_file.txt";
    fs.writeFileSync(path.join(uploads, stored), "hello");
    const { createId } = await import("../src/lib/id");
    db.run(
      `INSERT INTO attachments (id, issue_id, uploader_id, filename, stored_name, mime_type, size_bytes, created_at)
       VALUES (?, ?, ?, 'f.txt', ?, 'text/plain', 5, ?)`,
      [createId("att"), gone.id, actor.id, stored, db.nowIso()],
    );
    const { hardDeleteIssue } = await import("../src/lib/purge");
    hardDeleteIssue(gone.id, project.id);
    expect(fs.existsSync(path.join(uploads, stored))).toBe(false);
    expect(db.get(`SELECT id FROM issues WHERE id = ?`, [gone.id])).toBeUndefined();
  });
});
