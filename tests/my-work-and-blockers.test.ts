import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("My Work and Card Blockers/Progress (Roadmap Items 1 & 2)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dl-mywork-"));
    process.env.DASHBOARD_DATA_DIR = tempDir;
    process.env.DASHBOARD_DB_PATH = path.join(tempDir, "test.db");
  });

  afterEach(async () => {
    const { resetDbConnection } = await import("../src/lib/db");
    resetDbConnection();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("calculates blockers, subtasks, and epic progress on board and list", async () => {
    const db = await import("../src/lib/db");
    db.resetDbConnection();
    db.getDb();
    const { hashPassword } = await import("../src/lib/auth");
    const { createId } = await import("../src/lib/id");
    const { createProject, listStatuses } = await import("../src/lib/projects");
    const {
      createIssue,
      listBoardIssues,
      listIssues,
      getEpicProgressMap,
    } = await import("../src/lib/issues");

    const adminId = createId("usr");
    const memberId = createId("usr");
    const ts = db.nowIso();

    db.run(
      `INSERT INTO users (id, login, name, email, password_hash, global_role, active, created_at, updated_at)
       VALUES (?, 'admin', 'Admin User', NULL, ?, 'admin', 1, ?, ?)`,
      [adminId, hashPassword("secret12"), ts, ts],
    );
    db.run(
      `INSERT INTO users (id, login, name, email, password_hash, global_role, active, created_at, updated_at)
       VALUES (?, 'member', 'Member User', NULL, ?, 'user', 1, ?, ?)`,
      [memberId, hashPassword("secret12"), ts, ts],
    );

    const admin = {
      id: adminId,
      login: "admin",
      name: "Admin User",
      email: null,
      global_role: "admin" as const,
    };

    const project = createProject({
      key: "PRJ",
      name: "Project Blocker Test",
      leadId: adminId,
      actor: admin,
      memberIds: [memberId],
    });

    const statuses = listStatuses(project.id);
    const todoStatus = statuses.find((s) => s.category === "todo")!;
    const inProgressStatus = statuses.find((s) => s.category === "in_progress")!;
    const doneStatus = statuses.find((s) => s.category === "done")!;

    // Create an epic
    const epic = createIssue({
      projectId: project.id,
      type: "epic",
      title: "Main Epic",
      statusId: inProgressStatus.id,
      actor: admin,
    });

    // Create a blocker issue (currently in To Do, so it is an open blocker)
    const blockerIssue = createIssue({
      projectId: project.id,
      type: "task",
      title: "Blocker Issue",
      statusId: todoStatus.id,
      actor: admin,
      epicId: epic.id,
      storyPoints: 5,
    });

    // Create target issue blocked by blockerIssue
    const blockedIssue = createIssue({
      projectId: project.id,
      type: "task",
      title: "Blocked Issue",
      statusId: todoStatus.id,
      actor: admin,
      epicId: epic.id,
      storyPoints: 3,
    });

    // Add 'blocks' link: blockerIssue blocks blockedIssue
    db.run(
      `INSERT INTO issue_links (id, from_issue_id, to_issue_id, link_type, created_at) VALUES (?, ?, ?, 'blocks', ?)`,
      [createId("lnk"), blockerIssue.id, blockedIssue.id, ts],
    );

    // Create child subtasks for blockedIssue: 1 done, 1 open
    createIssue({
      projectId: project.id,
      type: "subtask",
      title: "Subtask 1 (Done)",
      statusId: doneStatus.id,
      parentId: blockedIssue.id,
      actor: admin,
    });
    createIssue({
      projectId: project.id,
      type: "subtask",
      title: "Subtask 2 (Open)",
      statusId: todoStatus.id,
      parentId: blockedIssue.id,
      actor: admin,
    });

    // Check listBoardIssues
    const boardAll = listBoardIssues(project.id);
    const blockedOnBoard = boardAll.find((i) => i.id === blockedIssue.id);
    expect(blockedOnBoard).toBeDefined();
    expect(blockedOnBoard?.open_blockers_count).toBe(1);
    expect(blockedOnBoard?.subtasks_done).toBe(1);
    expect(blockedOnBoard?.subtasks_total).toBe(2);

    const blockerOnBoard = boardAll.find((i) => i.id === blockerIssue.id);
    expect(blockerOnBoard?.open_blockers_count).toBe(0);

    // Test "only blocked" filter
    const boardBlockedOnly = listBoardIssues(project.id, { onlyBlocked: true });
    expect(boardBlockedOnly.length).toBe(1);
    expect(boardBlockedOnly[0].id).toBe(blockedIssue.id);

    // Check listIssues (list view table)
    const listAll = listIssues(project.id);
    const blockedOnList = listAll.find((i) => i.id === blockedIssue.id);
    expect(blockedOnList?.open_blockers_count).toBe(1);
    expect(blockedOnList?.subtasks_done).toBe(1);
    expect(blockedOnList?.subtasks_total).toBe(2);

    const listBlockedOnly = listIssues(project.id, { onlyBlocked: true });
    expect(listBlockedOnly.length).toBe(1);
    expect(listBlockedOnly[0].id).toBe(blockedIssue.id);

    // Check epic progress map
    const epicMap = getEpicProgressMap(project.id);
    expect(epicMap[epic.id]).toBeDefined();
    expect(epicMap[epic.id].totalSp).toBe(8); // 5 + 3
    expect(epicMap[epic.id].doneSp).toBe(0); // none done yet

    // Transition blockerIssue to Done -> open_blockers_count on blockedIssue should become 0!
    db.run(`UPDATE issues SET status_id = ? WHERE id = ?`, [
      doneStatus.id,
      blockerIssue.id,
    ]);

    const boardAfterDone = listBoardIssues(project.id);
    const blockedAfterDone = boardAfterDone.find((i) => i.id === blockedIssue.id);
    expect(blockedAfterDone?.open_blockers_count).toBe(0);

    const epicMapAfterDone = getEpicProgressMap(project.id);
    expect(epicMapAfterDone[epic.id].doneSp).toBe(5); // blockerIssue (5 SP) is now Done
  });

  it("gathers My Work morning sections and detects lead vs member roles", async () => {
    const db = await import("../src/lib/db");
    db.resetDbConnection();
    db.getDb();
    const { hashPassword } = await import("../src/lib/auth");
    const { createId } = await import("../src/lib/id");
    const { createProject, listStatuses } = await import("../src/lib/projects");
    const { createIssue, addComment } = await import("../src/lib/issues");
    const { isLeadOrAdmin } = await import("../src/lib/permissions");
    const { listMyWork } = await import("../src/lib/my-work");

    const adminId = createId("usr");
    const memberId = createId("usr");
    const ts = db.nowIso();

    db.run(
      `INSERT INTO users (id, login, name, email, password_hash, global_role, active, created_at, updated_at)
       VALUES (?, 'admin', 'Admin User', NULL, ?, 'admin', 1, ?, ?)`,
      [adminId, hashPassword("secret12"), ts, ts],
    );
    db.run(
      `INSERT INTO users (id, login, name, email, password_hash, global_role, active, created_at, updated_at)
       VALUES (?, 'member', 'Member User', NULL, ?, 'user', 1, ?, ?)`,
      [memberId, hashPassword("secret12"), ts, ts],
    );

    const admin = {
      id: adminId,
      login: "admin",
      name: "Admin User",
      email: null,
      global_role: "admin" as const,
    };
    const member = {
      id: memberId,
      login: "member",
      name: "Member User",
      email: null,
      global_role: "user" as const,
    };

    expect(isLeadOrAdmin(admin)).toBe(true);
    expect(isLeadOrAdmin(member)).toBe(false);

    const project = createProject({
      key: "MW",
      name: "My Work Project",
      leadId: adminId,
      actor: admin,
      memberIds: [memberId],
    });

    const statuses = listStatuses(project.id);
    const todoStatus = statuses.find((s) => s.category === "todo")!;
    const inProgressStatus = statuses.find((s) => s.category === "in_progress")!;
    const reviewStatus = statuses.find((s) => s.name === "Review") || inProgressStatus;

    // 1. Overdue issue assigned to member
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 2);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    createIssue({
      projectId: project.id,
      type: "task",
      title: "Overdue task",
      statusId: todoStatus.id,
      assigneeIds: [memberId],
      dueDate: yesterdayStr,
      actor: admin,
    });

    // 2. Due today issue assigned to member
    const todayStr = new Date().toISOString().slice(0, 10);
    createIssue({
      projectId: project.id,
      type: "task",
      title: "Today task",
      statusId: todoStatus.id,
      assigneeIds: [memberId],
      dueDate: todayStr,
      actor: admin,
    });

    // 3. In Progress issue assigned to member (no due date or future due date)
    createIssue({
      projectId: project.id,
      type: "task",
      title: "In progress task",
      statusId: inProgressStatus.id,
      assigneeIds: [memberId],
      actor: admin,
    });

    // 4. Waiting on me: member is reporter, someone else (admin) is assigned or working on it, status is Review / in_progress
    createIssue({
      projectId: project.id,
      type: "story",
      title: "Waiting on me task",
      statusId: reviewStatus.id,
      assigneeIds: [adminId],
      reporterId: memberId,
      actor: member,
    });

    // 5. Unread mention for member
    const issueWithMention = createIssue({
      projectId: project.id,
      type: "task",
      title: "Task with mention",
      statusId: todoStatus.id,
      actor: admin,
    });

    addComment({
      issueId: issueWithMention.id,
      author: admin,
      body: "Привіт @member, зверни увагу на це!",
    });

    // Run listMyWork for member
    const myWork = listMyWork(member);

    expect(myWork.overdue.length).toBe(1);
    expect(myWork.overdue[0].title).toBe("Overdue task");
    expect(myWork.overdue[0].available_statuses.length).toBeGreaterThan(0);

    expect(myWork.today.length).toBe(1);
    expect(myWork.today[0].title).toBe("Today task");

    expect(myWork.inProgress.length).toBe(1);
    expect(myWork.inProgress[0].title).toBe("In progress task");

    expect(myWork.waitingOnMe.length).toBe(1);
    expect(myWork.waitingOnMe[0].title).toBe("Waiting on me task");

    expect(myWork.unreadMentions.length).toBe(1);
    expect(myWork.unreadMentions[0].issue?.id).toBe(issueWithMention.id);
  });
});
