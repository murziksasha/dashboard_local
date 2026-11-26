"use client";

import { useMemo, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";

type User = { id: string; name: string; login?: string };

export function MentionTextarea({
  value,
  onChange,
  users,
  rows = 3,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  users: User[];
  rows?: number;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [active, setActive] = useState(0);
  const [cursor, setCursor] = useState(value.length);

  const hint = useMemo(() => {
    const pos = Math.min(cursor, value.length);
    const before = value.slice(0, pos);
    const at = before.lastIndexOf("@");
    if (at < 0) return { open: false, token: "", at: -1, pos, items: [] as User[] };
    const token = before.slice(at + 1);
    if (/\s/.test(token)) return { open: false, token: "", at: -1, pos, items: [] as User[] };
    const q = token.toLowerCase();
    const items = users
      .filter(
        (u) =>
          !q ||
          u.name.toLowerCase().includes(q) ||
          (u.login || "").toLowerCase().includes(q),
      )
      .slice(0, 8);
    return { open: true, token, at, pos, items };
  }, [value, users, cursor]);

  function insert(u: User) {
    const handle = u.login || u.name;
    const inserted = `@${handle} `;
    const next = `${value.slice(0, hint.at)}${inserted}${value.slice(hint.pos)}`;
    const nextPos = hint.at + inserted.length;
    onChange(next);
    setCursor(nextPos);
    setActive(0);
    requestAnimationFrame(() => {
      if (!ref.current) return;
      ref.current.focus();
      ref.current.setSelectionRange(nextPos, nextPos);
    });
  }

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        value={value}
        rows={rows}
        placeholder={placeholder}
        required
        onClick={(e) => setCursor(e.currentTarget.selectionStart ?? value.length)}
        onKeyUp={(e) => setCursor(e.currentTarget.selectionStart ?? value.length)}
        onChange={(e) => {
          setCursor(e.target.selectionStart ?? e.target.value.length);
          onChange(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (!hint.open || !hint.items.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (i + 1) % hint.items.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i - 1 + hint.items.length) % hint.items.length);
          } else if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            insert(hint.items[active] || hint.items[0]);
          } else if (e.key === "Escape") {
            e.preventDefault();
            onChange(value + " ");
          }
        }}
      />
      {hint.open && hint.items.length ? (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {hint.items.map((u, i) => (
            <li key={u.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-left ${
                  i === active ? "bg-sky-50 dark:bg-sky-950/50" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insert(u)}
              >
                <span>{u.name}</span>
                <span className="text-xs text-zinc-400">@{u.login || u.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
