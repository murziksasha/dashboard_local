import { settingGet } from "./db";
import { getOidcConfig } from "./oidc";

/** Canonical public base URL for redirects and notification links. */
export function getAppBaseUrl(reqUrl?: string): string {
  const fromSettings = settingGet("app_base_url")?.replace(/\/$/, "");
  if (fromSettings) return fromSettings;

  const env = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(
    /\/$/,
    "",
  );
  if (env) return env;

  try {
    const oidc = getOidcConfig().redirectUri;
    if (oidc) {
      return oidc.replace(/\/api\/auth\/oidc\/callback\/?$/, "");
    }
  } catch {
    // ignore
  }

  if (reqUrl) {
    try {
      const u = new URL(reqUrl);
      return `${u.protocol}//${u.host}`;
    } catch {
      // ignore
    }
  }

  return "http://localhost:3000";
}
