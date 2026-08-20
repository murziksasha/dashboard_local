import { cleanupExpiredSessions } from "./auth";
import { maybeAutoBackup } from "./backup";
import { runDueSoonNotifications } from "./due-soon";
import { run } from "./db";
import { purgeExpiredDeletedIssues } from "./purge";
import { snapshotAllActiveSprints } from "./reports";

declare global {
  var __dashboardJobsStarted: boolean | undefined;
}

const INTERVAL_MS = 5 * 60 * 1000;

function tick() {
  try {
    maybeAutoBackup();
  } catch {
    // non-fatal
  }
  try {
    runDueSoonNotifications(2);
  } catch {
    // non-fatal
  }
  try {
    cleanupExpiredSessions();
  } catch {
    // non-fatal
  }
  try {
    snapshotAllActiveSprints();
  } catch {
    // non-fatal
  }
  try {
    run(`DELETE FROM notifications WHERE created_at < datetime('now', '-90 day')`);
    run(`DELETE FROM activity_events WHERE created_at < datetime('now', '-180 day')`);
    run(`DELETE FROM app_events WHERE created_at < datetime('now', '-2 hour')`);
    run(`DELETE FROM audit_events WHERE created_at < datetime('now', '-365 day')`);
    purgeExpiredDeletedIssues();
  } catch {
    // non-fatal
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
