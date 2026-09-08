import { createHmac } from "crypto";
import { all, get, nowIso, run } from "./db";
import { createId } from "./id";
import { log } from "./logger";
import { decryptSecret } from "./secrets";

export type WebhookEvent = {
  id?: number;
  type: string;
  projectId?: string;
  issueId?: string;
  userId?: string;
  payload?: unknown;
  createdAt?: string;
};

export type WebhookRow = {
  id: string;
  project_id: string | null;
  url: string;
  secret: string | null;
  events: string;
  enabled: number;
  created_at: string;
};

export function listWebhooks(projectId?: string): WebhookRow[] {
  if (projectId) {
    return all<WebhookRow>(
      `SELECT id, project_id, url, secret, events, enabled, created_at
       FROM webhooks
       WHERE project_id IS NULL OR project_id = ?
       ORDER BY created_at DESC`,
      [projectId],
    );
  }
  return all<WebhookRow>(
    `SELECT id, project_id, url, secret, events, enabled, created_at
     FROM webhooks ORDER BY created_at DESC`,
  );
}

export function createWebhook(params: {
  url: string;
  projectId?: string | null;
  secret?: string | null;
  events?: string;
}): WebhookRow {
  const id = createId("wh");
  const ts = nowIso();
  const events = (params.events || "*").trim() || "*";
  run(
    `INSERT INTO webhooks (id, project_id, url, secret, events, enabled, created_at)
     VALUES (?, ?, ?, ?, ?, 1, ?)`,
    [id, params.projectId || null, params.url.trim(), params.secret?.trim() || null, events, ts],
  );
  return get<WebhookRow>(`SELECT * FROM webhooks WHERE id = ?`, [id])!;
}

export function deleteWebhook(id: string) {
  run(`DELETE FROM webhooks WHERE id = ?`, [id]);
}

export function setWebhookEnabled(id: string, enabled: boolean) {
  run(`UPDATE webhooks SET enabled = ? WHERE id = ?`, [enabled ? 1 : 0, id]);
}

function matchesEvent(spec: string, type: string): boolean {
  const parts = spec.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!parts.length || parts.includes("*")) return true;
  return parts.includes(type.toLowerCase());
}

function signBody(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

async function deliver(hook: WebhookRow, event: WebhookEvent) {
  const body = JSON.stringify({
    id: event.id,
    type: event.type,
    projectId: event.projectId,
    issueId: event.issueId,
    userId: event.userId,
    payload: event.payload,
    createdAt: event.createdAt || nowIso(),
  });
  const secret = hook.secret ? decryptSecret(hook.secret) || hook.secret : "";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "DashboardLocal-Webhook/1.0",
    "X-Dashboard-Event": event.type,
  };
  if (secret) headers["X-Dashboard-Signature"] = `sha256=${signBody(secret, body)}`;

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 8000);
  try {
    const res = await fetch(hook.url, {
      method: "POST",
      headers,
      body,
      signal: ac.signal,
    });
    run(
      `INSERT INTO webhook_deliveries (id, webhook_id, status, error, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [createId("whd"), hook.id, res.status, res.ok ? null : `http_${res.status}`, nowIso()],
    );
  } catch (e) {
    run(
      `INSERT INTO webhook_deliveries (id, webhook_id, status, error, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [createId("whd"), hook.id, 0, e instanceof Error ? e.message : String(e), nowIso()],
    );
  } finally {
    clearTimeout(t);
  }
}

export function dispatchWebhooks(event: WebhookEvent) {
  if (process.env.VITEST || process.env.NODE_ENV === "test") return;
  let hooks: WebhookRow[] = [];
  try {
    hooks = all<WebhookRow>(
      `SELECT id, project_id, url, secret, events, enabled, created_at
       FROM webhooks WHERE enabled = 1`,
    );
  } catch (e) {
    log.caught("webhooks.list_failed", e);
    return;
  }
  const matched = hooks.filter((h) => {
    if (!matchesEvent(h.events, event.type)) return false;
    if (h.project_id && event.projectId && h.project_id !== event.projectId) return false;
    return true;
  });
  for (const hook of matched) {
    void deliver(hook, event).catch((err) => log.caught("webhooks.deliver", err));
  }
}
