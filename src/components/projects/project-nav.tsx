"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function ProjectNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const items = [
    { href: `/projects/${projectId}`, label: "Дошка", exact: true },
    { href: `/projects/${projectId}/sprint`, label: "Sprint board" },
    { href: `/projects/${projectId}/list`, label: "Список" },
    { href: `/projects/${projectId}/backlog`, label: "Backlog" },
    { href: `/projects/${projectId}/gantt`, label: "Gantt" },
    { href: `/projects/${projectId}/jql`, label: "JQL" },
    { href: `/projects/${projectId}/dashboard`, label: "Дашборд" },
    { href: `/projects/${projectId}/settings`, label: "Налаштування" },
  ];
  return (
    <div className="flex flex-wrap gap-1 border-b border-zinc-200 pb-2 dark:border-zinc-800">
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium",
              active
                ? "bg-sky-600 text-white"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
