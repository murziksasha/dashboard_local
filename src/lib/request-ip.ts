export function clientIpFromHeaders(h: Headers | { get(name: string): string | null }): string {
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim().slice(0, 128) || "local";
  return (h.get("x-real-ip") || h.get("cf-connecting-ip") || "local").slice(0, 128);
}

export function userAgentFromHeaders(h: Headers | { get(name: string): string | null }): string | null {
  const ua = h.get("user-agent");
  return ua ? ua.slice(0, 240) : null;
}
