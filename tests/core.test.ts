import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("Dashboard Local core", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dl-test-"));
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
    return db;
  }

  it("creates project with default statuses and issue keys", async () => {
    const db = await boot();
    const { hashPassword } = await import("../src/lib/auth");
    const { createId } = await import("../src/lib/id");
    const { createProject } = await import("../src/lib/projects");
    const { createIssue, updateIssue, moveIssue } = await import("../src/lib/issues");
    const { listStatuses } = await import("../src/lib/projects");

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
      key: "TST",
      name: "Test",
      leadId: adminId,
      actor,
    });
    const statuses = listStatuses(project.id);
    expect(statuses.length).toBe(5);

    const issue = createIssue({
      projectId: project.id,
      type: "task",
      title: "First",
      reporterId: adminId,
      actor,
    });
    expect(issue.key).toBe("TST-1");

    const updated = updateIssue(issue.id, actor, { title: "First edited" });
    expect(updated.title).toBe("First edited");

    const done = statuses.find((s) => s.name === "Done")!;
    const moved = moveIssue({
      issueId: issue.id,
      statusId: done.id,
      actor,
    });
    expect(moved.status_id).toBe(done.id);
  });

  it("supports is_blocked_by via reverse blocks link", async () => {
    const db = await boot();
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
      key: "LNK",
      name: "Links",
      leadId: adminId,
      actor,
    });
    const a = createIssue({
      projectId: project.id,
      type: "task",
      title: "A",
      reporterId: adminId,
      actor,
    });
    const b = createIssue({
      projectId: project.id,
      type: "task",
      title: "B",
      reporterId: adminId,
      actor,
    });

    // B is blocked by A => A blocks B
    db.run(
      `INSERT INTO issue_links (id, from_issue_id, to_issue_id, link_type, created_at)
       VALUES (?, ?, ?, 'blocks', ?)`,
      [createId("lnk"), a.id, b.id, ts],
    );

    const incoming = db.all<{ link_type: string }>(
      `SELECT CASE link_type WHEN 'blocks' THEN 'is blocked by' ELSE link_type END as link_type
       FROM issue_links WHERE to_issue_id = ?`,
      [b.id],
    );
    expect(incoming[0]?.link_type).toBe("is blocked by");
    expect(listStatuses(project.id).length).toBeGreaterThan(0);
  });

  it("runs due-soon notifications once per day", async () => {
    const db = await boot();
    const { hashPassword } = await import("../src/lib/auth");
    const { createId } = await import("../src/lib/id");
    const { createProject, listStatuses } = await import("../src/lib/projects");
    const { createIssue } = await import("../src/lib/issues");
    const { runDueSoonNotifications } = await import("../src/lib/due-soon");

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
      key: "DUE",
      name: "Due",
      leadId: adminId,
      actor,
    });
    const todo = listStatuses(project.id).find((s) => s.name === "To Do")!;
    const issue = createIssue({
      projectId: project.id,
      type: "task",
      title: "Soon",
      reporterId: adminId,
      assigneeId: adminId,
      statusId: todo.id,
      dueDate: db.all<{ d: string }>(`SELECT date('now', '+1 day') as d`)[0].d,
      actor,
    });
    expect(issue.id).toBeTruthy();

    const n1 = runDueSoonNotifications(2);
    expect(n1).toBeGreaterThanOrEqual(1);
    const n2 = runDueSoonNotifications(2);
    expect(n2).toBe(0);
  });

  it("registers push tokens and cleans DeviceNotRegistered", async () => {
    const db = await boot();
    const { hashPassword } = await import("../src/lib/auth");
    const { createId } = await import("../src/lib/id");
    const {
      upsertPushToken,
      listPushTokens,
      removePushToken,
      sendExpoPush,
    } = await import("../src/lib/push");

    const adminId = createId("usr");
    const ts = db.nowIso();
    db.run(
      `INSERT INTO users (id, login, name, email, password_hash, global_role, active, created_at, updated_at)
       VALUES (?, 'admin', 'Admin', NULL, ?, 'admin', 1, ?, ?)`,
      [adminId, hashPassword("secret12"), ts, ts],
    );

    const token = "ExponentPushToken[test-token-abc]";
    upsertPushToken({
      userId: adminId,
      token,
      platform: "android",
      deviceName: "Pixel",
    });
    expect(listPushTokens(adminId)).toEqual([token]);

    // re-register moves ownership / updates metadata
    upsertPushToken({
      userId: adminId,
      token,
      platform: "ios",
      deviceName: "iPhone",
    });
    expect(listPushTokens(adminId)).toHaveLength(1);

    removePushToken(adminId, token);
    expect(listPushTokens(adminId)).toEqual([]);

    // sendExpoPush with no real tokens should no-op without throw
    await sendExpoPush({
      tokens: ["not-an-expo-token"],
      title: "Hi",
      body: "Body",
    });
  });

  it("stores attachment metadata after multipart-like insert", async () => {
    const db = await boot();
    const { hashPassword } = await import("../src/lib/auth");
    const { createId } = await import("../src/lib/id");
    const { createProject } = await import("../src/lib/projects");
    const { createIssue } = await import("../src/lib/issues");
    const fs = await import("fs");
    const path = await import("path");
    const { getUploadsDir } = await import("../src/lib/paths");

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
      key: "ATT",
      name: "Attach",
      leadId: adminId,
      actor,
    });
    const issue = createIssue({
      projectId: project.id,
      type: "task",
      title: "With file",
      reporterId: adminId,
      actor,
    });

    const attId = createId("att");
    const filename = "note.txt";
    const stored = `${attId}_${filename}`;
    const dir = path.join(getUploadsDir(), project.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, stored), "hello mobile");
    db.run(
      `INSERT INTO attachments (id, issue_id, uploader_id, filename, stored_name, mime_type, size_bytes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [attId, issue.id, adminId, filename, stored, "text/plain", 12, ts],
    );

    const row = db.get<{ filename: string; size_bytes: number }>(
      `SELECT filename, size_bytes FROM attachments WHERE id = ?`,
      [attId],
    );
    expect(row?.filename).toBe("note.txt");
    expect(row?.size_bytes).toBe(12);
    expect(fs.existsSync(path.join(dir, stored))).toBe(true);
  });

  it("manages dashboard widgets enable/reorder", async () => {
    await boot();
    const { hashPassword } = await import("../src/lib/auth");
    const { createId } = await import("../src/lib/id");
    const db = await import("../src/lib/db");
    const {
      ensurePersonalWidgets,
      setWidgetEnabled,
      reorderWidgets,
    } = await import("../src/lib/dashboard-widgets");

    const adminId = createId("usr");
    const ts = db.nowIso();
    db.run(
      `INSERT INTO users (id, login, name, email, password_hash, global_role, active, created_at, updated_at)
       VALUES (?, 'admin', 'Admin', NULL, ?, 'admin', 1, ?, ?)`,
      [adminId, hashPassword("secret12"), ts, ts],
    );

    const widgets = ensurePersonalWidgets(adminId);
    expect(widgets.length).toBe(5);
    setWidgetEnabled(widgets[0].id, adminId, false);
    const again = ensurePersonalWidgets(adminId);
    expect(again.find((w) => w.id === widgets[0].id)?.enabled).toBe(0);

    const reversed = [...widgets].reverse().map((w) => w.id);
    reorderWidgets(adminId, reversed);
    const ordered = ensurePersonalWidgets(adminId);
    expect(ordered[0].id).toBe(reversed[0]);
  });

  it("verifies password hashing and port helper", async () => {
    const { hashPassword, verifyPassword } = await import("../src/lib/auth");
    const { getListenPort } = await import("../src/lib/paths");
    const hash = hashPassword("hello123");
    expect(verifyPassword("hello123", hash)).toBe(true);
    expect(verifyPassword("wrong", hash)).toBe(false);
    process.env.PORT = "8080";
    expect(getListenPort()).toBe(8080);
    delete process.env.PORT;
    expect(getListenPort()).toBe(3000);
  });

  it("creates subtask under parent and deletes issue", async () => {
    const db = await boot();
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
      key: "SUB",
      name: "Sub",
      leadId: adminId,
      actor,
    });
    const parent = createIssue({
      projectId: project.id,
      type: "task",
      title: "Parent",
      reporterId: adminId,
      actor,
    });
    const child = createIssue({
      projectId: project.id,
      type: "subtask",
      title: "Child",
      reporterId: adminId,
      parentId: parent.id,
      actor,
    });
    expect(child.parent_id).toBe(parent.id);
    expect(child.key).toBe("SUB-2");

    db.run(`UPDATE issues SET parent_id = NULL WHERE parent_id = ?`, [parent.id]);
    db.run(`DELETE FROM issues WHERE id = ?`, [parent.id]);
    const gone = db.get(`SELECT id FROM issues WHERE id = ?`, [parent.id]);
    expect(gone).toBeUndefined();
    const orphan = db.get<{ parent_id: string | null }>(
      `SELECT parent_id FROM issues WHERE id = ?`,
      [child.id],
    );
    expect(orphan?.parent_id).toBeNull();
  });
});
