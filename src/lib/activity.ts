import { createId } from "./id";
import { nowIso, run } from "./db";

export function logActivity(params: {
  projectId: string;
  issueId?: string | null;
  actorId?: string | null;
  action: string;
  payload?: unknown;
}) {
  run(
    `INSERT INTO activity_events (id, project_id, issue_id, actor_id, action, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      createId("act"),
      params.projectId,
      params.issueId ?? null,
      params.actorId ?? null,
      params.action,
      params.payload ? JSON.stringify(params.payload) : null,
      nowIso(),
    ],
  );
}
