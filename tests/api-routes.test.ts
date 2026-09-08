import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("API routes", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dl-api-"));
    process.env.DASHBOARD_DATA_DIR = tempDir;
    process.env.DASHBOARD_DB_PATH = path.join(tempDir, "test.db");
  });

  afterEach(async () => {
    const { resetDbConnection } = await import("../src/lib/db");
    resetDbConnection();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  async function bootUser() {
    const db = await import("../src/lib/db");
    db.resetDbConnection();
    db.getDb();
    const { hashPassword } = await import("../src/lib/auth");
    const { createId } = await import("../src/lib/id");
    const id = createId("usr");
    const ts = db.nowIso();
    db.run(
      `INSERT INTO users (id, login, name, email, password_hash, global_role, active, created_at, updated_at)
       VALUES (?, 'admin', 'Admin', NULL, ?, 'admin', 1, ?, ?)`,
      [id, hashPassword("secret12"), ts, ts],
    );
    return { db, id };
  }

  it("login issues a token and health is ok", async () => {
    await bootUser();
    const { POST } = await import("../src/app/api/auth/login/route");
    const res = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ login: "admin", password: "secret12" }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string };
    expect(body.token.startsWith("dl_")).toBe(true);

    const { GET } = await import("../src/app/api/health/route");
    const health = await GET();
    expect(health.status).toBe(200);
    const h = (await health.json()) as { ok: boolean; db: string };
    expect(h.ok).toBe(true);
    expect(h.db).toBe("ok");
  });

  it("rejects invalid login", async () => {
    await bootUser();
    const { POST } = await import("../src/app/api/auth/login/route");
    const res = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ login: "admin", password: "nope-nope" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("caps active API tokens", async () => {
    const { id } = await bootUser();
    const { issueApiToken, MAX_API_TOKENS, countActiveApiTokens } = await import(
      "../src/lib/api-auth"
    );
    for (let i = 0; i < 8; i++) issueApiToken(id);
    expect(countActiveApiTokens(id)).toBeLessThanOrEqual(MAX_API_TOKENS);
  });

  it("creates issue via REST", async () => {
    const { id } = await bootUser();
    const { createProject } = await import("../src/lib/projects");
    const actor = {
      id,
      login: "admin",
      name: "Admin",
      email: null,
      global_role: "admin" as const,
    };
    const project = createProject({ key: "API", name: "Api", leadId: id, actor });
    const { issueApiToken } = await import("../src/lib/api-auth");
    const token = issueApiToken(id);
    const { POST } = await import("../src/app/api/projects/[id]/issues/route");
    const res = await POST(
      new Request(`http://localhost/api/projects/${project.id}/issues`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ title: "From API", type: "task" }),
      }),
      { params: Promise.resolve({ id: project.id }) },
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { issue: { key: string } };
    expect(body.issue.key).toBe("API-1");
  });
});
