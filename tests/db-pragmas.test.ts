import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("sqlite pragmas and indexes", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dl-pragma-"));
    process.env.DASHBOARD_DATA_DIR = tempDir;
    process.env.DASHBOARD_DB_PATH = path.join(tempDir, "test.db");
  });

  afterEach(async () => {
    const { resetDbConnection } = await import("../src/lib/db");
    resetDbConnection();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("enables busy_timeout and expected indexes", async () => {
    const dbmod = await import("../src/lib/db");
    dbmod.resetDbConnection();
    const db = dbmod.getDb();

    const timeoutRow = db.prepare("PRAGMA busy_timeout").get() as Record<
      string,
      unknown
    >;
    const timeout = Number(Object.values(timeoutRow)[0]);
    expect(timeout).toBe(5000);

    const names = dbmod
      .all<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type = 'index'`,
      )
      .map((r) => r.name);

    for (const idx of [
      "idx_issues_project_rank",
      "idx_issues_project_updated",
      "idx_issues_due",
      "idx_issues_parent",
      "idx_issues_key",
      "idx_notifications_user_unread",
      "idx_activity_issue",
      "idx_attachments_issue",
      "idx_worklogs_issue",
      "idx_issue_labels_label",
      "idx_cf_values_issue",
      "idx_sessions_expires",
    ]) {
      expect(names).toContain(idx);
    }
  });

  it("count() returns a number without throwing", async () => {
    const dbmod = await import("../src/lib/db");
    dbmod.resetDbConnection();
    dbmod.getDb();
    expect(dbmod.count(`SELECT COUNT(*) as c FROM users`)).toBe(0);
  });
});
