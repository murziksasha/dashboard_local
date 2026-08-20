import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("sqlite event bus", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dl-ev-"));
    process.env.DASHBOARD_DATA_DIR = tempDir;
    process.env.DASHBOARD_DB_PATH = path.join(tempDir, "test.db");
  });

  afterEach(async () => {
    const { resetDbConnection } = await import("../src/lib/db");
    resetDbConnection();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("persists events so another reader can poll them", async () => {
    const db = await import("../src/lib/db");
    db.resetDbConnection();
    db.getDb();
    const events = await import("../src/lib/events");
    events.emitAppEvent({ type: "board", projectId: "p1", payload: { n: 1 } });
    events.emitAppEvent({ type: "notification", userId: "u1" });
    const rows = events.listAppEventsSince(0);
    expect(rows.length).toBe(2);
    expect(rows[0]?.type).toBe("board");
    expect(rows[1]?.type).toBe("notification");
    expect(events.listAppEventsSince(rows[0]!.id!).length).toBe(1);
  });
});
