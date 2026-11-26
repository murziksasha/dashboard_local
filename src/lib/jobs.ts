import { cleanupExpiredSessions } from "./auth";
import { maybeAutoBackup } from "./backup";
import { runDueSoonNotifications } from "./due-soon";
import { run } from "./db";
import { log } from "./logger";
import { purgeExpiredDeletedIssues } from "./purge";
import { runRecurringIssues } from "./recurring";
import { snapshotAllActiveSprints } from "./reports";

declare global {
  var __dashboardJobsStarted: boolean | undefined;
}

const INTERVAL_MS = 5 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function isoAgo(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

function tick() {
  try {
    maybeAutoBackup();
  } catch (e) {
    log.caught("jobs.backup", e);
  }
  try {
    runDueSoonNotifications(2);
  } catch (e) {
    log.caught("jobs.due_soon", e);
  }
  try {
    cleanupExpiredSessions();
  } catch (e) {
    log.caught("jobs.sessions", e);
  }
  try {
    snapshotAllActiveSprints();
  } catch (e) {
    log.caught("jobs.sprint_snapshot", e);
  }
  try {
    runRecurringIssues();
  } catch (e) {
    log.caught("jobs.recurring", e);
  }
  try {
    const now = new Date().toISOString();
    run(`DELETE FROM notifications WHERE created_at < ?`, [isoAgo(90 * DAY_MS)]);
    run(`DELETE FROM activity_events WHERE created_at < ?`, [isoAgo(180 * DAY_MS)]);
    run(`DELETE FROM app_events WHERE created_at < ?`, [isoAgo(2 * HOUR_MS)]);
    run(`DELETE FROM audit_events WHERE created_at < ?`, [isoAgo(365 * DAY_MS)]);
    run(`DELETE FROM webhook_deliveries WHERE created_at < ?`, [isoAgo(30 * DAY_MS)]);
    run(`DELETE FROM oidc_states WHERE expires_at < ?`, [now]);
    purgeExpiredDeletedIssues();
  } catch (e) {
    log.caught("jobs.cleanup", e);
  }
}

/** Once per Node process. Skipped in tests so vitest does not leak timers. */
export function ensureBackgroundJobs() {
  if (process.env.VITEST || process.env.NODE_ENV === "test") return;
  if (global.__dashboardJobsStarted) return;
  global.__dashboardJobsStarted = true;
  tick();
  setInterval(tick, INTERVAL_MS).unref?.();
}
