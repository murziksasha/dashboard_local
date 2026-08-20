import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("project load layers", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dl-ctx-"));
    process.env.DASHBOARD_DATA_DIR = tempDir;
    process.env.DASHBOARD_DB_PATH = path.join(tempDir, "test.db");
  });

  afterEach(async () => {
    const { resetDbConnection } = await import("../src/lib/db");
    resetDbConnection();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("board query omits description and listEpics is scoped", async () => {
    const db = await import("../src/lib/db");
    db.resetDbConnection();
    db.getDb();
    const { hashPassword } = await import("../src/lib/auth");
    const { createId } = await import("../src/lib/id");
    const { createProject } = await import("../src/lib/projects");
    const { createIssue, listBoardIssues, listEpics } = await import(
      "../src/lib/issues"
    );
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
      key: "BRD",
      name: "Board",
      leadId: adminId,
      actor,
    });
    createIssue({
      projectId: project.id,
      type: "epic",
      title: "Epic A",
      description: "secret markdown",
      reporterId: adminId,
      actor,
    });
    createIssue({
      projectId: project.id,
      type: "task",
      title: "Task A",
      description: "should not ship to board",
      reporterId: adminId,
      actor,
    });

    const board = listBoardIssues(project.id);
    expect(board.some((i) => i.title === "Task A")).toBe(true);
    expect(board.every((i) => !("description" in i) || i.description === undefined)).toBe(
      true,
    );

    const epics = listEpics(project.id);
    expect(epics.map((e) => e.title)).toEqual(["Epic A"]);
    expect(epics[0]).not.toHaveProperty("description");
  });
});
