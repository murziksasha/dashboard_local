import { z } from "zod";
import { log } from "./logger";

const EnvSchema = z.object({
  NODE_ENV: z.string().optional(),
  APP_URL: z.string().optional(),
  APP_BASE_URL: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().optional(),
  DASHBOARD_SECRET: z.string().optional(),
  APP_SECRET: z.string().optional(),
  TRUST_PROXY: z.string().optional(),
  COOKIE_SECURE: z.string().optional(),
  PORT: z.string().optional(),
  DASHBOARD_DATA_DIR: z.string().optional(),
  DASHBOARD_DB_PATH: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
});

export type AppEnv = z.infer<typeof EnvSchema>;

let cached: AppEnv | null = null;

export function loadEnv(): AppEnv {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    log.warn("env.invalid", { issues: parsed.error.issues.map((i) => i.path.join(".")) });
    cached = {};
    return cached;
  }
  cached = parsed.data;
  return cached;
}

export function publicBaseUrlFromEnv(): string {
  const env = loadEnv();
  return (env.APP_URL || env.APP_BASE_URL || env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
}

export function cookieSecureFlag(): boolean {
  const env = loadEnv();
  if (env.COOKIE_SECURE === "1" || env.COOKIE_SECURE === "true") return true;
  const base = publicBaseUrlFromEnv();
  return base.startsWith("https://");
}

export function trustProxy(): boolean {
  const env = loadEnv();
  if (env.TRUST_PROXY === "1" || env.TRUST_PROXY === "true") return true;
  return publicBaseUrlFromEnv().startsWith("https://");
}
