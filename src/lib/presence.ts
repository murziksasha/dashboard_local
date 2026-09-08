export type PresencePeer = {
  userId: string;
  name: string;
  issueId?: string;
  projectId?: string;
  seenAt: number;
};

declare global {
  var __dashboardPresence: Map<string, PresencePeer> | undefined;
}

const TTL_MS = 45_000;

function store(): Map<string, PresencePeer> {
  if (!global.__dashboardPresence) global.__dashboardPresence = new Map();
  return global.__dashboardPresence;
}

function prune(now = Date.now()) {
  const s = store();
  for (const [k, v] of s) {
    if (now - v.seenAt > TTL_MS) s.delete(k);
  }
}

export function heartbeatPresence(peer: Omit<PresencePeer, "seenAt">) {
  const now = Date.now();
  prune(now);
  const key = `${peer.userId}:${peer.projectId || ""}:${peer.issueId || ""}`;
  store().set(key, { ...peer, seenAt: now });
}

export function listPresence(opts: { projectId?: string; issueId?: string; excludeUserId?: string }): PresencePeer[] {
  prune();
  const out: PresencePeer[] = [];
  const seenUsers = new Set<string>();
  for (const peer of store().values()) {
    if (opts.excludeUserId && peer.userId === opts.excludeUserId) continue;
    if (opts.issueId && peer.issueId !== opts.issueId) continue;
    if (opts.projectId && peer.projectId !== opts.projectId) continue;
    if (seenUsers.has(peer.userId)) continue;
    seenUsers.add(peer.userId);
    out.push(peer);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
