import fs from "fs";
import { DatabaseSync } from "node:sqlite";
import {
  getBackupsDir,
  getDataDir,
  getDbPath,
  getUploadsDir,
} from "./paths";

declare global {
  var __dashboardDb: DatabaseSync | undefined;
}

function ensureDirs() {
  for (const dir of [getDataDir(), getUploadsDir(), getBackupsDir()]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

function migrate(db: DatabaseSync) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      login TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      global_role TEXT NOT NULL DEFAULT 'user' CHECK (global_role IN ('admin', 'user')),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      description TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS team_members (
      team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (team_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name TEXT NOT NULL,
      description TEXT,
      lead_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      issue_seq INTEGER NOT NULL DEFAULT 0,
      archived INTEGER NOT NULL DEFAULT 0,
      board_version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_members (
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('lead', 'member', 'viewer')),
      PRIMARY KEY (project_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS project_teams (
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('lead', 'member', 'viewer')),
      PRIMARY KEY (project_id, team_id)
    );

    CREATE TABLE IF NOT EXISTS statuses (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('todo', 'in_progress', 'done')),
      position INTEGER NOT NULL DEFAULT 0,
      wip_limit INTEGER,
      UNIQUE (project_id, name)
    );

    CREATE TABLE IF NOT EXISTS sprints (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      goal TEXT,
      start_date TEXT,
      end_date TEXT,
      status TEXT NOT NULL DEFAULT 'future' CHECK (status IN ('future', 'active', 'closed')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      key TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL CHECK (type IN ('epic', 'story', 'task', 'bug', 'subtask')),
      title TEXT NOT NULL,
      description TEXT,
      status_id TEXT NOT NULL REFERENCES statuses(id),
      priority TEXT NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('highest', 'high', 'medium', 'low', 'lowest')),
      assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      reporter_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      parent_id TEXT REFERENCES issues(id) ON DELETE SET NULL,
      epic_id TEXT REFERENCES issues(id) ON DELETE SET NULL,
      sprint_id TEXT REFERENCES sprints(id) ON DELETE SET NULL,
      story_points REAL,
      original_estimate_sec INTEGER,
      remaining_estimate_sec INTEGER,
      due_date TEXT,
      rank TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS issue_labels (
      issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
      label TEXT NOT NULL COLLATE NOCASE,
      PRIMARY KEY (issue_id, label)
    );

    CREATE TABLE IF NOT EXISTS issue_links (
      id TEXT PRIMARY KEY,
      from_issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
      to_issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
      link_type TEXT NOT NULL CHECK (link_type IN ('blocks', 'relates', 'duplicates')),
      created_at TEXT NOT NULL,
      UNIQUE (from_issue_id, to_issue_id, link_type)
    );

    CREATE TABLE IF NOT EXISTS watchers (
      issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (issue_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS custom_field_defs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      field_type TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'select', 'date', 'user')),
      options_json TEXT,
      required INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS custom_field_values (
      field_id TEXT NOT NULL REFERENCES custom_field_defs(id) ON DELETE CASCADE,
      issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
      value TEXT,
      PRIMARY KEY (field_id, issue_id)
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
      author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
      uploader_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT,
      size_bytes INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS worklogs (
      id TEXT PRIMARY KEY,
      issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      seconds INTEGER NOT NULL,
      work_date TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity_events (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      issue_id TEXT REFERENCES issues(id) ON DELETE CASCADE,
      actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      payload_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      link TEXT,
      read_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS saved_filters (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      query_json TEXT NOT NULL,
      shared INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dashboard_widgets (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      scope TEXT NOT NULL CHECK (scope IN ('personal', 'project')),
      project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      widget_type TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      config_json TEXT
    );

    CREATE TABLE IF NOT EXISTS issue_assignees (
      issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      position INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (issue_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS api_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workflow_rules (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      from_status_id TEXT REFERENCES statuses(id) ON DELETE CASCADE,
      to_status_id TEXT REFERENCES statuses(id) ON DELETE CASCADE,
      require_assignee INTEGER NOT NULL DEFAULT 0,
      require_due_date INTEGER NOT NULL DEFAULT 0,
      block_if_open_blockers INTEGER NOT NULL DEFAULT 0,
      only_roles TEXT,
      enabled INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS oidc_states (
      state TEXT PRIMARY KEY,
      code_verifier TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS push_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      platform TEXT,
      device_name TEXT,
      updated_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_issues_project ON issues(project_id);
    CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status_id);
    CREATE INDEX IF NOT EXISTS idx_issues_assignee ON issues(assignee_id);
    CREATE INDEX IF NOT EXISTS idx_issues_sprint ON issues(sprint_id);
    CREATE INDEX IF NOT EXISTS idx_issues_epic ON issues(epic_id);
    CREATE INDEX IF NOT EXISTS idx_issue_assignees_user ON issue_assignees(user_id);
    CREATE INDEX IF NOT EXISTS idx_activity_project ON activity_events(project_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_comments_issue ON comments(issue_id);
  `);

  ensureColumn(db, "issues", "start_date", "TEXT");
  // backfill assignees from legacy assignee_id
  db.exec(`
    INSERT OR IGNORE INTO issue_assignees (issue_id, user_id, position)
    SELECT id, assignee_id, 0 FROM issues WHERE assignee_id IS NOT NULL
  `);
}

function ensureColumn(db: DatabaseSync, table: string, column: string, typeSql: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeSql}`);
  }
}

export function getDb(): DatabaseSync {
  if (global.__dashboardDb) return global.__dashboardDb;
  ensureDirs();
  const db = new DatabaseSync(getDbPath());
  migrate(db);
  global.__dashboardDb = db;
  return db;
}

/** Close and forget the singleton (for tests / restore). */
export function resetDbConnection() {
  try {
    global.__dashboardDb?.close();
  } catch {
    // ignore
  }
  global.__dashboardDb = undefined;
}

export function nowIso() {
  return new Date().toISOString();
}

export type Row = Record<string, unknown>;

/** node:sqlite returns null-prototype objects; React client props need plain objects. */
function plain<T>(value: T): T {
  if (value == null || typeof value !== "object") return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

export function all<T = Row>(sql: string, params: unknown[] = []): T[] {
  return plain(getDb().prepare(sql).all(...params) as T[]);
}

export function get<T = Row>(sql: string, params: unknown[] = []): T | undefined {
  const row = getDb().prepare(sql).get(...params) as T | undefined;
  return row === undefined ? undefined : plain(row);
}

export function run(sql: string, params: unknown[] = []) {
  return getDb().prepare(sql).run(...params);
}

export function settingGet(key: string): string | undefined {
  const row = get<{ value: string }>("SELECT value FROM settings WHERE key = ?", [
    key,
  ]);
  return row?.value;
}

export function settingSet(key: string, value: string) {
  run(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}
