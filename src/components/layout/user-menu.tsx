"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { logoutAction } from "@/app/actions/auth";
import { avatarColor, initials } from "@/lib/utils";

function readDensity(): "comfortable" | "compact" {
  if (typeof window === "undefined") return "comfortable";
  return window.localStorage.getItem("dl-density") === "compact"
    ? "compact"
    : "comfortable";
}

function applyDensity(value: "comfortable" | "compact") {
  document.documentElement.dataset.density = value;
  localStorage.setItem("dl-density", value);
}

export function DensityHydrate() {
  useEffect(() => {
    applyDensity(readDensity());
  }, []);
  return null;
}

export function UserMenu({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const root = useRef<HTMLDivElement>(null);
  const { theme, setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    setDensity(readDensity());
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
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

  const dark = (theme === "system" ? resolvedTheme : theme) === "dark";

  return (
    <div className="relative" ref={root}>
      <button
        type="button"
        className="flex size-8 items-center justify-center rounded-full text-xs font-semibold text-white"
        style={{ background: avatarColor(name) }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Меню профілю"
        onClick={() => setOpen((v) => !v)}
      >
        {initials(name)}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-zinc-200 bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        >
          <Link
            href="/profile"
            role="menuitem"
            className="block px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
            onClick={() => setOpen(false)}
          >
            Профіль
          </Link>
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
            onClick={() => setTheme(dark ? "light" : "dark")}
          >
            {dark ? "Світла тема" : "Темна тема"}
          </button>
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
            onClick={() => {
              const next = density === "compact" ? "comfortable" : "compact";
              setDensity(next);
              applyDensity(next);
            }}
          >
            {density === "compact" ? "Звичайна щільність" : "Компактний вигляд"}
          </button>
          <form action={logoutAction}>
            <button
              type="submit"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-sm text-rose-600 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Вийти
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}


