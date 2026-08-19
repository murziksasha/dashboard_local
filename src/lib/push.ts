import { all, nowIso, run } from "./db";
import { createId } from "./id";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export function upsertPushToken(params: {
  userId: string;
  token: string;
  platform?: string | null;
  deviceName?: string | null;
}) {
  const token = params.token.trim();
  if (!token) throw new Error("token_required");
  const ts = nowIso();
  const existing = all<{ id: string }>(
    `SELECT id FROM push_tokens WHERE token = ?`,
    [token],
  )[0];
  if (existing) {
    run(
      `UPDATE push_tokens
       SET user_id = ?, platform = ?, device_name = ?, updated_at = ?
       WHERE id = ?`,
      [
        params.userId,
        params.platform ?? null,
        params.deviceName ?? null,
        ts,
        existing.id,
      ],
    );
    return existing.id;
  }
  const id = createId("psh");
  run(
    `INSERT INTO push_tokens (id, user_id, token, platform, device_name, updated_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.userId,
      token,
      params.platform ?? null,
      params.deviceName ?? null,
      ts,
      ts,
    ],
  );
  return id;
}

export function removePushToken(userId: string, token: string) {
  run(`DELETE FROM push_tokens WHERE user_id = ? AND token = ?`, [
    userId,
    token.trim(),
  ]);
}

export function listPushTokens(userId: string): string[] {
  return all<{ token: string }>(
    `SELECT token FROM push_tokens WHERE user_id = ?`,
    [userId],
  ).map((r) => r.token);
}

function isExpoPushToken(token: string): boolean {
  return (
    token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[")
  );
}

/** Send Expo push notifications; remove tokens Expo marks as DeviceNotRegistered. */
export async function sendExpoPush(params: {
  tokens: string[];
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}) {
  const tokens = [...new Set(params.tokens.filter(isExpoPushToken))];
  if (!tokens.length) return;

  const messages = tokens.map((to) => ({
    to,
    sound: "default" as const,
    title: params.title,
    body: params.body || undefined,
    data: params.data || {},
  }));

  // Expo accepts batches up to ~100
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk),
      });
      if (!res.ok) continue;
      const json = (await res.json().catch(() => null)) as {
        data?: Array<{ status?: string; details?: { error?: string } }>;
      } | null;
      const results = json?.data || [];
      results.forEach((item, idx) => {
        if (
          item?.status === "error" &&
          item.details?.error === "DeviceNotRegistered"
        ) {
          const bad = chunk[idx]?.to;
          if (bad) run(`DELETE FROM push_tokens WHERE token = ?`, [bad]);
        }
      });
    } catch {
      // non-fatal
    }
  }
}
