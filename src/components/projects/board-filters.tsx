"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export function BoardFilters({
  projectId,
  currentUserId,
  hasSprint,
}: {
  projectId: string;
  currentUserId: string;
  hasSprint: boolean;
}) {
  const sp = useSearchParams();
  const scope = sp.get("scope") || (hasSprint ? "sprint" : "all");
  const assignee = sp.get("assignee") || "";
  const due = sp.get("due") || "";
  const type = sp.get("type") || "";

  function href(patch: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (!v) next.delete(k);
      else next.set(k, v);
    }
    const q = next.toString();
    return `/projects/${projectId}${q ? `?${q}` : ""}`;
  }

  const chip = (active: boolean) =>
    cn(
      "rounded-full px-3 py-1 text-xs font-medium",
      active ? "bg-sky-600 text-white" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
    );

  return (
    <div className="flex flex-wrap gap-2">
      {hasSprint ? (
        <>
          <Link href={href({ scope: "sprint" })} className={chip(scope !== "all")}>
            Спринт
          </Link>
          <Link href={href({ scope: "all" })} className={chip(scope === "all")}>
            Увесь проєкт
          </Link>
        </>
      ) : null}
      <Link
        href={href({ assignee: assignee === "me" ? null : "me" })}
        className={chip(assignee === "me" || assignee === currentUserId)}
      >
        Я
      </Link>
      <Link href={href({ due: due === "overdue" ? null : "overdue" })} className={chip(due === "overdue")}>
        Прострочені
      </Link>
      <Link href={href({ type: type === "bug" ? null : "bug" })} className={chip(type === "bug")}>
        Баги
      </Link>
    </div>
  );
}
