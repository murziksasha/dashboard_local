import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("mentions", () => {
  it("extracts latin and cyrillic handles", async () => {
    const { extractMentions } = await import("../src/lib/notifications");
    expect(extractMentions("hey @alice and @Марія_1")).toEqual(["alice", "Марія_1"]);
  });

  let tempDir: string;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dl-men-"));
    process.env.DASHBOARD_DATA_DIR = tempDir;
    process.env.DASHBOARD_DB_PATH = path.join(tempDir, "test.db");
  });
  afterEach(async () => {
    const { resetDbConnection } = await import("../src/lib/db");
    resetDbConnection();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("notifies user mentioned by cyrillic name", async () => {
    const db = await import("../src/lib/db");
    db.resetDbConnection();
    db.getDb();
    const { hashPassword } = await import("../src/lib/auth");
    const { createId } = await import("../src/lib/id");
    const { createProject } = await import("../src/lib/projects");
    const { createIssue, addComment } = await import("../src/lib/issues");
    const adminId = createId("usr");
    const mariaId = createId("usr");
    const ts = db.nowIso();
    db.run(
      `INSERT INTO users (id, login, name, email, password_hash, global_role, active, created_at, updated_at)
       VALUES (?, 'admin', 'Admin', NULL, ?, 'admin', 1, ?, ?)`,
      [adminId, hashPassword("secret12"), ts, ts],
    );
    db.run(
      `INSERT INTO users (id, login, name, email, password_hash, global_role, active, created_at, updated_at)
       VALUES (?, 'maria', 'Марія', NULL, ?, 'user', 1, ?, ?)`,
      [mariaId, hashPassword("secret12"), ts, ts],
    );
    const actor = {
      id: adminId,
      login: "admin",
      name: "Admin",
      email: null,
      global_role: "admin" as const,
    };
    const project = createProject({
      key: "MEN",
      name: "Mentions",
      leadId: adminId,
      actor,
      memberIds: [mariaId],
    });
    const issue = createIssue({
      projectId: project.id,
      type: "task",
      title: "Talk",
      reporterId: adminId,
      actor,
    });
    addComment({ issueId: issue.id, author: actor, body: "Привіт @Марія" });
    const n = db.get<{ title: string }>(
      `SELECT title FROM notifications WHERE user_id = ?`,
      [mariaId],
    );
    expect(n?.title).toMatch(/згадав/);
  });
});
