"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import {
  listNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

type Item = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [, startTransition] = useTransition();

  async function refresh() {
    const res = await listNotificationsAction();
    setItems(res.items);
    setUnread(res.unread);
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Сповіщення"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="size-4" />
        {unread > 0 ? (
          <span className="absolute right-1 top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </Button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[90vw] rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
            <p className="text-sm font-semibold">Сповіщення</p>
            <button
              type="button"
              className="text-xs text-sky-600 hover:underline"
              onClick={() =>
                startTransition(async () => {
                  await markAllNotificationsReadAction();
                  await refresh();
                })
              }
            >
              Прочитати всі
            </button>
          </div>
          <div className="max-h-80 overflow-auto">
            {items.length === 0 ? (
              <p className="p-4 text-sm text-zinc-500">Поки немає сповіщень.</p>
            ) : (
              items.map((item) => (
                <Link
                  key={item.id}
                  href={item.link || "#"}
                  className={`block border-b border-zinc-100 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60 ${
                    item.read_at ? "opacity-70" : ""
                  }`}
                  onClick={() => {
                    setOpen(false);
                    startTransition(async () => {
                      await markNotificationReadAction(item.id);
                      await refresh();
                    });
                  }}
                >
                  <p className="font-medium">{item.title}</p>
                  {item.body ? (
                    <p className="line-clamp-2 text-xs text-zinc-500">{item.body}</p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-zinc-400">
                    {formatDate(item.created_at, true)}
                  </p>
                </Link>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
