"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";

type Hit = { id: string; key: string; title: string; project_id: string; project_key: string };
type Proj = { id: string; key: string; name: string };

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [q, setQ] = useState("");
  const [issues, setIssues] = useState<Hit[]>([]);
  const [projects, setProjects] = useState<Proj[]>([]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const typing =
        t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (!typing && e.key === "/") {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (!typing && e.key === "?") {
        e.preventDefault();
        setHelp(true);
      }
      if (!typing && e.key.toLowerCase() === "c") {
        const m = window.location.pathname.match(/^\/projects\/([^/]+)/);
        if (m) {
          e.preventDefault();
          router.push(`/projects/${m[1]}`);
          document.querySelector<HTMLButtonElement>("button")?.blur();
          const btn = [...document.querySelectorAll("button")].find(
            (b) => b.textContent?.includes("Нова задача"),
          );
          btn?.click();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { issues: Hit[]; projects: Proj[] };
      setIssues(data.issues || []);
      setProjects(data.projects || []);
    }, 150);
    return () => clearTimeout(t);
  }, [q, open]);

  return (
    <>
      <Dialog open={open} onClose={() => setOpen(false)} title="Пошук">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Задача, ключ, проєкт…"
          className="mb-3 h-9 w-full rounded-md border border-zinc-300 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <div className="max-h-72 space-y-1 overflow-auto text-sm">
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"
              onClick={() => {
                setOpen(false);
                router.push(`/projects/${p.id}`);
              }}
            >
              <span className="font-medium">{p.key}</span> {p.name}
            </button>
          ))}
          {issues.map((i) => (
            <button
              key={i.id}
              type="button"
              className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"
              onClick={() => {
                setOpen(false);
                router.push(`/projects/${i.project_id}/issues/${i.id}`);
              }}
            >
              <span className="font-medium text-sky-600">{i.key}</span> {i.title}
            </button>
          ))}
          {q && !issues.length && !projects.length ? (
            <p className="px-2 py-2 text-zinc-500">Нічого не знайдено.</p>
          ) : null}
        </div>
      </Dialog>
      <Dialog open={help} onClose={() => setHelp(false)} title="Клавіші">
        <ul className="space-y-1 text-sm">
          <li>
            <kbd>Ctrl</kbd>+<kbd>K</kbd> / <kbd>/</kbd> — пошук
          </li>
          <li>
            <kbd>c</kbd> — нова задача (на екрані проєкту)
          </li>
          <li>
            <kbd>Esc</kbd> — закрити панель
          </li>
          <li>
            <kbd>?</kbd> — ця довідка
          </li>
        </ul>
      </Dialog>
    </>
  );
}
