import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("webhooks templates health", () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dl-wh-"));
    process.env.DASHBOARD_DATA_DIR = tempDir;
    process.env.DASHBOARD_DB_PATH = path.join(tempDir, "test.db");
  });
  afterEach(async () => {
    const { resetDbConnection } = await import("../src/lib/db");
    resetDbConnection();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("stores webhooks and templates", async () => {
    const db = await import("../src/lib/db");
    db.resetDbConnection();
    db.getDb();
    const { hashPassword } = await import("../src/lib/auth");
    const { createId } = await import("../src/lib/id");
    const { createProject } = await import("../src/lib/projects");
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
    const project = createProject({ key: "WH", name: "Wh", leadId: adminId, actor });
    const { createWebhook, listWebhooks } = await import("../src/lib/webhooks");
    createWebhook({ url: "http://localhost:9/hook", projectId: project.id, events: "issue" });
    expect(listWebhooks(project.id).length).toBe(1);

    const { seedBuiltinTemplates, listIssueTemplates } = await import(
      "../src/lib/issue-templates"
    );
    seedBuiltinTemplates(project.id);
    expect(listIssueTemplates(project.id).length).toBeGreaterThan(0);

    const { getHealth } = await import("../src/lib/health");
    expect(getHealth().ok).toBe(true);
  });
});
