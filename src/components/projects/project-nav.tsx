"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function ProjectNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  const primary = [
    { href: base, label: "Дошка", exact: true },
    { href: `${base}/list`, label: "Список" },
    { href: `${base}/backlog`, label: "Беклог" },
  ];
  const more = [
    { href: `${base}/sprint`, label: "Спринт" },
    { href: `${base}/gantt`, label: "Гант" },
    { href: `${base}/jql`, label: "JQL" },
    { href: `${base}/calendar`, label: "Календар" },
    { href: `${base}/reports`, label: "Звіти" },
    { href: `${base}/dashboard`, label: "Дашборд" },
    { href: `${base}/trash`, label: "Кошик" },
    { href: `${base}/settings`, label: "Налаштування" },
  ];
  const moreActive = more.some((item) => pathname.startsWith(item.href));
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function itemClass(active: boolean) {
    return cn(
      "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium",
      active
        ? "bg-sky-600 text-white"
        : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
    );
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-zinc-200 pb-2 dark:border-zinc-800">
      {primary.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} className={itemClass(active)}>
            {item.label}
          </Link>
        );
      })}
      <div className="relative" ref={box}>
        <button
          type="button"
          className={itemClass(moreActive)}
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((v) => !v)}
        >
          Ще ▾
        </button>
        {open ? (
          <div
            role="menu"
            className="absolute left-0 z-40 mt-1 min-w-44 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          >
            {more.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={cn(
                    "block px-3 py-1.5 text-sm",
                    active
                      ? "bg-sky-50 font-medium text-sky-700 dark:bg-sky-950/50 dark:text-sky-200"
                      : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
