"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FolderKanban,
  LayoutDashboard,
  Settings,
  Users,
  UsersRound,
  DatabaseBackup,
  Menu,
  X,
  User,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Дашборд", icon: LayoutDashboard },
  { href: "/projects", label: "Проєкти", icon: FolderKanban },
  { href: "/teams", label: "Команди", icon: UsersRound },
  { href: "/profile", label: "Профіль", icon: User },
];

const adminLinks = [
  { href: "/admin/users", label: "Користувачі", icon: Users },
  { href: "/admin/teams", label: "Керування командами", icon: UsersRound },
  { href: "/admin/backups", label: "Бекапи", icon: DatabaseBackup },
  { href: "/admin/settings", label: "Налаштування", icon: Settings },
];

export function AppSidebar({
  appName,
  isAdmin,
}: {
  appName: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const Nav = (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {links.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
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
        {Nav}
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-xl dark:bg-zinc-950">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <span className="font-semibold">{appName}</span>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="size-4" />
              </button>
            </div>
            {Nav}
          </div>
        </div>
      ) : null}
    </>
  );
}
