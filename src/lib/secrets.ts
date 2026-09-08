import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { get, run } from "./db";
import { loadEnv } from "./env";

const PREFIX = "enc:v1:";

function keyBytes(): Buffer {
  const env = loadEnv();
  const raw = env.DASHBOARD_SECRET || env.APP_SECRET || "dashboard-local-dev-key";
  return createHash("sha256").update(raw).digest();
}

export function encryptSecret(plain: string): string {
  if (!plain) return "";
  if (plain.startsWith(PREFIX)) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptSecret(stored: string | undefined | null): string {
  if (!stored) return "";
  if (!stored.startsWith(PREFIX)) return stored;
  try {
    const rest = stored.slice(PREFIX.length);
    const [ivHex, tagHex, dataHex] = rest.split(":");
    if (!ivHex || !tagHex || !dataHex) return "";
    const decipher = createDecipheriv("aes-256-gcm", keyBytes(), Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const out = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
    return out.toString("utf8");
  } catch {
    return "";
  }
}

export function settingGetSecret(key: string): string {
  const row = get<{ value: string }>("SELECT value FROM settings WHERE key = ?", [key]);
  return decryptSecret(row?.value);
}

export function settingSetSecret(key: string, value: string) {
  const stored = value ? encryptSecret(value) : "";
  run(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, stored],
  );
}

export function secretIsSet(key: string): boolean {
  const row = get<{ value: string }>("SELECT value FROM settings WHERE key = ?", [key]);
  return !!(row?.value && row.value.length > 0);
}
