import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("rank packing", () => {
  it("packedRanks is lexicographically sorted", async () => {
    const { packedRanks, rankBetween } = await import("../src/lib/id");
    const ranks = packedRanks(12);
    const sorted = [...ranks].sort();
    expect(ranks).toEqual(sorted);
    expect(ranks[0] < ranks[11]).toBe(true);

    let r = "a0";
    for (let i = 0; i < 40; i++) r = rankBetween(r, null);
    expect(r.length).toBeGreaterThan(32);
  });

  let tempDir: string;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dl-rank-"));
    process.env.DASHBOARD_DATA_DIR = tempDir;
    process.env.DASHBOARD_DB_PATH = path.join(tempDir, "test.db");
  });
  afterEach(async () => {
    const { resetDbConnection } = await import("../src/lib/db");
    resetDbConnection();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("rebalanceRanks shortens keys and keeps order", async () => {
    const db = await import("../src/lib/db");
    db.resetDbConnection();
    db.getDb();
    const { hashPassword } = await import("../src/lib/auth");
    const { createId } = await import("../src/lib/id");
    const { createProject, listStatuses } = await import("../src/lib/projects");
    const { createIssue, rebalanceRanks, listBoardIssues } = await import(
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
      key: "RNK",
      name: "Rank",
      leadId: adminId,
      actor,
    });
    const todo = listStatuses(project.id).find((s) => s.name === "To Do")!;
    const a = createIssue({
      projectId: project.id,
      type: "task",
      title: "First",
      reporterId: adminId,
      actor,
    });
    const b = createIssue({
      projectId: project.id,
      type: "task",
      title: "Second",
      reporterId: adminId,
      actor,
    });
    db.run(`UPDATE issues SET rank = ? WHERE id = ?`, ["a".repeat(40), a.id]);
    db.run(`UPDATE issues SET rank = ? WHERE id = ?`, ["a".repeat(40) + "b", b.id]);
    rebalanceRanks(project.id, todo.id);
    const board = listBoardIssues(project.id);
    const titles = board
      .filter((i) => i.status_id === todo.id)
      .map((i) => i.title);
    expect(titles[0]).toBe("First");
    expect(titles[1]).toBe("Second");
    const ranks = db.all<{ rank: string }>(
      `SELECT rank FROM issues WHERE project_id = ? ORDER BY rank`,
      [project.id],
    );
    expect(ranks.every((r) => r.rank.length <= 8)).toBe(true);
  });
});
