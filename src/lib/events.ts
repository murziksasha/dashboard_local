import { EventEmitter } from "events";
import { all, nowIso, run } from "./db";

export type AppEvent = {
  id?: number;
  type: "board" | "issue" | "notification";
  projectId?: string;
  issueId?: string;
  userId?: string;
  payload?: unknown;
  createdAt?: string;
};

declare global {
  var __dashboardEvents: EventEmitter | undefined;
}

function bus(): EventEmitter {
  if (!global.__dashboardEvents) {
    global.__dashboardEvents = new EventEmitter();
    global.__dashboardEvents.setMaxListeners(200);
  }
  return global.__dashboardEvents;
}

export function persistAppEvent(event: AppEvent): number | undefined {
  try {
    const info = run(
      `INSERT INTO app_events (type, project_id, issue_id, user_id, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        event.type,
        event.projectId ?? null,
        event.issueId ?? null,
        event.userId ?? null,
        event.payload == null ? null : JSON.stringify(event.payload),
        event.createdAt || nowIso(),
      ],
    );
    const id = Number((info as { lastInsertRowid?: number | bigint }).lastInsertRowid);
    return Number.isFinite(id) ? id : undefined;
  } catch {
    return undefined;
  }
}

export function emitAppEvent(event: AppEvent) {
  const id = persistAppEvent(event);
  const next = { ...event, id };
  bus().emit("app", next);
  if (event.projectId) bus().emit(`project:${event.projectId}`, next);
  if (event.userId) bus().emit(`user:${event.userId}`, next);
}

export function onAppEvent(fn: (e: AppEvent) => void) {
  bus().on("app", fn);
  return () => bus().off("app", fn);
}

export function listAppEventsSince(lastId: number, limit = 100): AppEvent[] {
  const rows = all<{
    id: number;
    type: AppEvent["type"];
    project_id: string | null;
    issue_id: string | null;
    user_id: string | null;
    payload_json: string | null;
    created_at: string;
  }>(
    `SELECT id, type, project_id, issue_id, user_id, payload_json, created_at
     FROM app_events WHERE id > ? ORDER BY id ASC LIMIT ?`,
    [lastId, limit],
  );
  return rows.map((row) => ({
    id: Number(row.id),
    type: row.type,
    projectId: row.project_id || undefined,
    issueId: row.issue_id || undefined,
    userId: row.user_id || undefined,
    createdAt: row.created_at,
    payload: row.payload_json
      ? (() => {
          try {
            return JSON.parse(row.payload_json);
          } catch {
            return row.payload_json;
          }
        })()
      : undefined,
  }));
}

export function latestAppEventId(): number {
  const row = all<{ id: number }>(`SELECT COALESCE(MAX(id), 0) as id FROM app_events`)[0];
  return Number(row?.id ?? 0);
}
