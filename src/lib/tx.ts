import { getDb } from "./db";
import { log } from "./logger";

declare global {
  var __dashboardTxDepth: number | undefined;
}

function depth(): number {
  return global.__dashboardTxDepth ?? 0;
}

function setDepth(n: number) {
  global.__dashboardTxDepth = n;
}

export function inTransaction(): boolean {
  return depth() > 0;
}

/** BEGIN IMMEDIATE with savepoints for nested calls. */
export function withTransaction<T>(fn: () => T): T {
  const db = getDb();
  const d = depth();
  if (d === 0) {
    db.exec("BEGIN IMMEDIATE");
    setDepth(1);
    try {
      const result = fn();
      db.exec("COMMIT");
      setDepth(0);
      return result;
    } catch (e) {
      try {
        db.exec("ROLLBACK");
      } catch (rollbackErr) {
        log.caught("tx.rollback_failed", rollbackErr);
      }
      setDepth(0);
      throw e;
    }
  }
  const sp = `sp_${d}`;
  db.exec(`SAVEPOINT ${sp}`);
  setDepth(d + 1);
  try {
    const result = fn();
    db.exec(`RELEASE ${sp}`);
    setDepth(d);
    return result;
  } catch (e) {
    try {
      db.exec(`ROLLBACK TO ${sp}`);
      db.exec(`RELEASE ${sp}`);
    } catch (rollbackErr) {
      log.caught("tx.savepoint_rollback_failed", rollbackErr);
    }
    setDepth(d);
    throw e;
  }
}
