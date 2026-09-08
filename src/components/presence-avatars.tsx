"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";

type Peer = { userId: string; name: string };

export function PresenceAvatars({
  projectId,
  issueId,
}: {
  projectId: string;
  issueId?: string;
}) {
  const [peers, setPeers] = useState<Peer[]>([]);
  useEffect(() => {
    let stop = false;
    async function beat() {
      try {
        const res = await fetch("/api/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, issueId }),
        });
        if (!res.ok || stop) return;
        const data = (await res.json()) as { peers?: Peer[] };
        setPeers(data.peers || []);
      } catch {
        // ignore
      }
    }
    beat();
    const t = setInterval(beat, 15000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [projectId, issueId]);
  if (!peers.length) return null;
  return (
    <div className="flex items-center gap-1" title={peers.map((p) => p.name).join(", ")}>
      {peers.slice(0, 5).map((p) => (
        <Avatar key={p.userId} name={p.name} />
      ))}
    </div>
  );
}
