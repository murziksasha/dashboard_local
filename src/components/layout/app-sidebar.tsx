"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FolderKanban,
  LayoutDashboard,
  Settings,
  Users,
  UsersRound,
  DatabaseBackup,
  ClipboardList,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Дашборд", icon: LayoutDashboard },
  { href: "/projects", label: "Проєкти", icon: FolderKanban },
  { href: "/teams", label: "Команди", icon: UsersRound },
];

const adminLinks = [
  { href: "/admin/users", label: "Користувачі", icon: Users },
  { href: "/admin/teams", label: "Керування командами", icon: UsersRound },
  { href: "/admin/backups", label: "Бекапи", icon: DatabaseBackup },
  { href: "/admin/audit", label: "Аудит", icon: ClipboardList },
  { href: "/admin/settings", label: "Налаштування", icon: Settings },
];

export type SidebarProject = { id: string; key: string; name: string };

function ProjectSwitcher({
  projects,
  onNavigate,
}: {
  projects: SidebarProject[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const match = pathname.match(/^\/projects\/([^/]+)/);
  const currentId = match?.[1];
  const current = projects.find((p) => p.id === currentId);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return projects.slice(0, 12);
    return projects
      .filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.key.toLowerCase().includes(query),
      )
      .slice(0, 12);
  }, [projects, q]);

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

  if (!projects.length) return null;

  return (
    <div className="relative px-3 pb-2" ref={box}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="min-w-0">
          <span className="block truncate font-medium">
            {current ? current.name : "Обрати проєкт"}
          </span>
          {current ? (
            <span className="block text-[11px] text-zinc-500">{current.key}</span>
          ) : null}
        </span>
        <ChevronDown className="size-4 shrink-0 text-zinc-400" />
      </button>
      {open ? (
        <div className="absolute left-3 right-3 z-40 mt-1 rounded-lg border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {projects.length > 8 ? (
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Пошук проєкту…"
              className="mb-2 h-8 w-full rounded-md border border-zinc-300 px-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          ) : null}
          <ul className="max-h-64 overflow-auto">
            {filtered.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800",
                    p.id === currentId && "bg-sky-50 dark:bg-sky-950/40",
                  )}
                  onClick={() => {
                    setOpen(false);
                    onNavigate?.();
                    router.push(`/projects/${p.id}`);
                  }}
                >
                  <span className="truncate">{p.name}</span>
                  <span className="ml-2 text-[11px] text-zinc-400">{p.key}</span>
                </button>
              </li>
            ))}
            {!filtered.length ? (
              <li className="px-2 py-1.5 text-xs text-zinc-400">Немає збігів</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function AppSidebar({
  appName,
  isAdmin,
  projects,
}: {
  appName: string;
  isAdmin: boolean;
  projects: SidebarProject[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = original;
      prev?.focus?.();
    };
  }, [open]);

  const Nav = (
    <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Основне меню">
      {links.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === "/projects"
            ? pathname === "/projects"
            : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sky-600 text-white"
                : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
      {isAdmin ? (
        <>
          <p className="mt-4 px-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Адмін
          </p>
          {adminLinks.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sky-600 text-white"
                    : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </>
      ) : null}
    </nav>
  );

  return (
    <>
      <button
        type="button"
        className="fixed left-3 top-3 z-40 rounded-md border border-zinc-200 bg-white p-2 shadow md:hidden dark:border-zinc-700 dark:bg-zinc-900"
        onClick={() => setOpen(true)}
        aria-label="Меню"
      >
        <Menu className="size-4" />
      </button>

      <aside className="hidden w-64 shrink-0 border-r border-zinc-200 bg-white md:flex md:flex-col dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
          <Link href="/dashboard" className="text-lg font-bold tracking-tight">
            {appName}
          </Link>
          <p className="text-xs text-zinc-500">Локальний трекер задач</p>
        </div>
        <ProjectSwitcher projects={projects} />
        {Nav}
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Закрити меню"
            onClick={() => setOpen(false)}
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Меню"
            className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-xl dark:bg-zinc-950"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <span className="font-semibold">{appName}</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Закрити">
                <X className="size-4" />
              </button>
            </div>
            <ProjectSwitcher projects={projects} onNavigate={() => setOpen(false)} />
            {Nav}
          </div>
        </div>
      ) : null}
    </>
  );
}
