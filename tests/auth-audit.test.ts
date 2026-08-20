import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("login rate limit and audit", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dl-aud-"));
    process.env.DASHBOARD_DATA_DIR = tempDir;
    process.env.DASHBOARD_DB_PATH = path.join(tempDir, "test.db");
  });

  afterEach(async () => {
    const { resetDbConnection } = await import("../src/lib/db");
    resetDbConnection();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("locks after 5 failures from the same IP+login", async () => {
    const db = await import("../src/lib/db");
    db.resetDbConnection();
    db.getDb();
    const audit = await import("../src/lib/audit");
    for (let i = 0; i < 5; i++) {
      audit.logAudit({ action: "login.fail", login: "admin", ip: "10.0.0.8", detail: "invalid" });
    }
    expect(audit.countRecentLoginFails("admin", "10.0.0.8")).toBe(5);
    const locked = audit.assertLoginAllowed("admin", "10.0.0.8");
    expect(locked).toMatch(/Забагато спроб/);
    expect(audit.assertLoginAllowed("admin", "10.0.0.9")).toBeNull();
  });

  it("stores login.ok in audit log", async () => {
    const db = await import("../src/lib/db");
    db.resetDbConnection();
    db.getDb();
    const audit = await import("../src/lib/audit");
    audit.logAudit({
      action: "login.ok",
      login: "admin",
      ip: "127.0.0.1",
      detail: "local",
    });
    const rows = audit.listAuditEvents();
    expect(rows[0]?.action).toBe("login.ok");
    expect(rows[0]?.ip).toBe("127.0.0.1");
  });
});
