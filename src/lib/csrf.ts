/** Edge-safe CSRF / origin checks for mutating REST API requests. */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function parseHost(value: string | null): string | null {
  if (!value) return null;
  try {
    if (value.startsWith("http://") || value.startsWith("https://")) {
      return new URL(value).host.toLowerCase();
    }
    return new URL(`http://${value}`).host.toLowerCase();
  } catch {
    return null;
  }
}

export function allowedHosts(requestUrl: string, envUrl?: string | null): Set<string> {
  const hosts = new Set<string>();
  const reqHost = parseHost(requestUrl);
  if (reqHost) hosts.add(reqHost);
  if (envUrl) {
    const envHost = parseHost(envUrl);
    if (envHost) hosts.add(envHost);
  }
  hosts.add("localhost:3000");
  hosts.add("127.0.0.1:3000");
  return hosts;
}

export function requestOriginHost(headers: Headers): string | null {
  const origin = headers.get("origin");
  if (origin) return parseHost(origin);
  const referer = headers.get("referer");
  if (referer) return parseHost(referer);
  return null;
}

/**
 * Browser cross-site POSTs always send Origin. Native / curl often send none.
 * Allow missing Origin (non-browser) and require Origin/Referer to match the app host otherwise.
 */
export function isMutatingApiCsrfOk(req: {
  method: string;
  url: string;
  headers: Headers;
  envUrl?: string | null;
}): boolean {
  if (SAFE_METHODS.has(req.method.toUpperCase())) return true;
  if (req.headers.get("authorization")?.trim()) return true;
  const originHost = requestOriginHost(req.headers);
  if (!originHost) return true;
  return allowedHosts(req.url, req.envUrl).has(originHost);
}
