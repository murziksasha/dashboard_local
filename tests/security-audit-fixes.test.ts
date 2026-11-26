import { describe, expect, it } from "vitest";
import { getFreshDb, setupTestDb } from "./helpers";
import { hashPassword } from "../src/lib/auth";
import { createProject, listStatuses } from "../src/lib/projects";
import { createIssue, updateIssue } from "../src/lib/issues";
import { loadIssueWorkspace } from "../src/lib/issue-workspace";
import { createWebhook, deleteWebhook, isSafeWebhookUrl, listWebhooks } from "../src/lib/webhooks";
import { createIssueTemplate, deleteIssueTemplate, listIssueTemplates } from "../src/lib/issue-templates";
import { createRecurring, deleteRecurring, listRecurring } from "../src/lib/recurring";
import { createId, rankBetween } from "../src/lib/id";
import { countRecentLoginFails, logAudit } from "../src/lib/audit";
import { purgeExpiredDeletedIssues } from "../src/lib/purge";
import { nowIso, run } from "../src/lib/db";
import { runJql } from "../src/lib/jql";
import { createBackup, restoreBackup } from "../src/lib/backup";
import type { SessionUser } from "../src/lib/types";

setupTestDb();

function makeUser(login: string, name: string, globalRole: "admin" | "user" = "user"): SessionUser {
  const id = createId("usr");
  const ts = nowIso();
  run(
    `INSERT INTO users (id, login, name, email, password_hash, global_role, active, created_at, updated_at)
     VALUES (?, ?, ?, NULL, ?, ?, 1, ?, ?)`,
    [id, login, name, hashPassword("secret12"), globalRole, ts, ts],
  );
  return { id, login, name, email: null, global_role: globalRole };
}

describe("security & integrity audit fixes", () => {
  it("enforces project access in loadIssueWorkspace and blocks cross-project refs", async () => {
    await getFreshDb();
    const admin = makeUser("admin1", "Admin", "admin");
    const outsider = makeUser("out1", "Outsider", "user");
    const p1 = createProject({ key: "ONE", name: "Project One", leadId: admin.id, actor: admin });
    const p2 = createProject({ key: "TWO", name: "Project Two", leadId: admin.id, actor: admin });
    const s1 = listStatuses(p1.id);
    const s2 = listStatuses(p2.id);

    const issue1 = createIssue({
      projectId: p1.id,
      type: "task",
      title: "Issue 1",
      reporterId: admin.id,
      actor: admin,
      statusId: s1[0].id,
    });

    expect(() => loadIssueWorkspace(outsider, p1.id, issue1.id)).toThrow("FORBIDDEN");
    expect(loadIssueWorkspace(admin, p1.id, issue1.id)?.issue.id).toBe(issue1.id);

    expect(() =>
      updateIssue(issue1.id, admin, { statusId: s2[0].id }),
    ).toThrow();
  });

  it("isolates webhooks, templates, and recurring rules by project and blocks metadata SSRF URLs", async () => {
    await getFreshDb();
    const admin = makeUser("admin2", "Admin", "admin");
    const p1 = createProject({ key: "WHA", name: "WH A", leadId: admin.id, actor: admin });
    const p2 = createProject({ key: "WHB", name: "WH B", leadId: admin.id, actor: admin });

    const gHook = createWebhook({ projectId: null, url: "https://example.com/global", events: "*" });
    const p1Hook = createWebhook({ projectId: p1.id, url: "https://example.com/p1", events: "*" });

    expect(listWebhooks().map((w) => w.id)).toEqual([gHook.id]);
    expect(listWebhooks(p1.id).map((w) => w.id)).toEqual([p1Hook.id]);
    expect(listWebhooks(p2.id)).toEqual([]);

    deleteWebhook(p1Hook.id, p2.id);
    expect(listWebhooks(p1.id).map((w) => w.id)).toEqual([p1Hook.id]);

    expect(isSafeWebhookUrl("https://example.com/hook")).toBe(true);
    expect(isSafeWebhookUrl("http://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isSafeWebhookUrl("http://metadata.google.internal/computeMetadata/v1/")).toBe(false);
    expect(isSafeWebhookUrl("http://0.0.0.0:3000/api")).toBe(false);
    expect(isSafeWebhookUrl("file:///etc/passwd")).toBe(false);

    const tpl = createIssueTemplate({ projectId: p1.id, name: "T1", type: "task", priority: "medium" });
    deleteIssueTemplate(tpl.id, p2.id);
    expect(listIssueTemplates(p1.id).some((t) => t.id === tpl.id)).toBe(true);

    const rec = createRecurring({ projectId: p1.id, title: "R1", frequency: "weekly", createdBy: admin.id });
    deleteRecurring(rec.id, p2.id);
    expect(listRecurring(p1.id).some((r) => r.id === rec.id)).toBe(true);
  });

  it("preserves 0 story points and keeps rankBetween monotonic", async () => {
    await getFreshDb();
    const admin = makeUser("admin3", "Admin", "admin");
    const p = createProject({ key: "ZER", name: "Zero", leadId: admin.id, actor: admin });
    const issue = createIssue({
      projectId: p.id,
      type: "task",
      title: "Zero SP",
      reporterId: admin.id,
      actor: admin,
      storyPoints: 0,
    });
    expect(issue.story_points).toBe(0);

    const updated = updateIssue(issue.id, admin, { storyPoints: 0 });
    expect(updated?.story_points).toBe(0);

    let r = "m";
    for (let i = 0; i < 40; i++) {
      const prev = rankBetween(null, r);
      expect(prev < r).toBe(true);
      const mid = rankBetween(prev, r);
      expect(prev < mid && mid < r).toBe(true);
      r = prev;
    }
  });

  it("handles ISO-8601 timestamps in login lockouts and 30-day trash purge", async () => {
    await getFreshDb();
    const admin = makeUser("admin4", "Admin", "admin");
    const p = createProject({ key: "ISO", name: "ISO", leadId: admin.id, actor: admin });

    logAudit({ action: "login.fail", login: "admin4", ip: "192.0.2.10" });
    expect(countRecentLoginFails("admin4", "192.0.2.10")).toBe(1);

    const oldIssue = createIssue({ projectId: p.id, type: "task", title: "Old deleted", reporterId: admin.id, actor: admin });
    const recentIssue = createIssue({ projectId: p.id, type: "task", title: "Recent deleted", reporterId: admin.id, actor: admin });
    const oldDate = new Date(Date.now() - 40 * 86400_000).toISOString();
    const recentDate = new Date(Date.now() - 2 * 86400_000).toISOString();
    run(`UPDATE issues SET deleted_at = ? WHERE id = ?`, [oldDate, oldIssue.id]);
    run(`UPDATE issues SET deleted_at = ? WHERE id = ?`, [recentDate, recentIssue.id]);

    const purged = purgeExpiredDeletedIssues();
    expect(purged).toBe(1);
  });

  it("supports strict JQL assignee matching and natural key sorting", async () => {
    await getFreshDb();
    const admin = makeUser("ann", "Ann", "admin");
    const other = makeUser("ann2", "Ann Two", "user");
    const p = createProject({ key: "JQL", name: "JQL", leadId: admin.id, actor: admin, memberIds: [other.id] });

    for (let i = 1; i <= 10; i++) {
      createIssue({
        projectId: p.id,
        type: "task",
        title: `Task ${i}`,
        reporterId: admin.id,
        actor: admin,
        assigneeIds: i === 1 ? [admin.id] : [other.id],
        labels: [i === 2 ? "backend" : "frontend"],
      });
    }

    const strict = runJql(p.id, "assignee = ann", admin.id);
    expect(strict.issues.map((i) => i.key)).toEqual(["JQL-1"]);

    const notLabel = runJql(p.id, "labels != backend", admin.id);
    expect(notLabel.issues.some((i) => i.key === "JQL-2")).toBe(false);

    const sorted = runJql(p.id, "ORDER BY key ASC", admin.id);
    expect(sorted.issues.slice(0, 3).map((i) => i.key)).toEqual(["JQL-1", "JQL-2", "JQL-3"]);
    expect(sorted.issues.at(-1)?.key).toBe("JQL-10");
  });

  it("creates and restores backups cleanly on Windows", async () => {
    await getFreshDb();
    const admin = makeUser("admin5", "Admin", "admin");
    const p = createProject({ key: "BKP", name: "Backup", leadId: admin.id, actor: admin });
    createIssue({ projectId: p.id, type: "task", title: "Before backup", reporterId: admin.id, actor: admin });

    const bkp = createBackup();
    createIssue({ projectId: p.id, type: "task", title: "After backup", reporterId: admin.id, actor: admin });

    restoreBackup(bkp);
    const { issues } = runJql(p.id, "", admin.id);
    expect(issues.map((i) => i.title)).toEqual(["Before backup"]);
  });
});
