/** In-memory sliding window. Fine for a single LAN Node process. */

type Bucket = { times: number[] };

declare global {
  var __dashboardRateLimit: Map<string, Bucket> | undefined;
}

function store(): Map<string, Bucket> {
  if (!globalThis.__dashboardRateLimit) {
    globalThis.__dashboardRateLimit = new Map();
  }
  return globalThis.__dashboardRateLimit;
}

export function rateLimitHit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): { ok: boolean; remaining: number; retryAfterMs: number } {
  const buckets = store();
  const bucket = buckets.get(key) || { times: [] };
  const cutoff = now - windowMs;
  bucket.times = bucket.times.filter((t) => t > cutoff);
  if (bucket.times.length >= limit) {
    buckets.set(key, bucket);
    const retryAfterMs = Math.max(0, bucket.times[0]! + windowMs - now);
    return { ok: false, remaining: 0, retryAfterMs };
  }
  bucket.times.push(now);
  buckets.set(key, bucket);
  return { ok: true, remaining: limit - bucket.times.length, retryAfterMs: 0 };
}

export function rateLimitReset() {
  store().clear();
}
