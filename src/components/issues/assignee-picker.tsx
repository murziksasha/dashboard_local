"use client";

import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type PickerUser = { id: string; name: string; login?: string };

export function AssigneePicker({
  users,
  value,
  onChange,
  disabled,
}: {
  users: PickerUser[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [q, setQ] = useState("");
  const selected = users.filter((u) => value.includes(u.id));
  const available = useMemo(() => {
    const query = q.trim().toLowerCase();
    return users.filter((u) => {
      if (value.includes(u.id)) return false;
      if (!query) return true;
      return (
        u.name.toLowerCase().includes(query) ||
        (u.login || "").toLowerCase().includes(query)
      );
    });
  }, [users, value, q]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {selected.map((u) => (
          <span
            key={u.id}
            className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 py-0.5 pl-1 pr-2 text-xs dark:border-zinc-700 dark:bg-zinc-800"
          >
            <Avatar name={u.name} className="size-4 text-[8px]" />
            {u.name}
            {disabled ? null : (
              <button
                type="button"
                className="text-zinc-400 hover:text-zinc-700"
                onClick={() => onChange(value.filter((id) => id !== u.id))}
                aria-label={`Прибрати ${u.name}`}
              >
                ×
              </button>
            )}
          </span>
        ))}
        {!selected.length ? (
          <span className="text-xs text-zinc-400">Не призначено</span>
        ) : null}
      </div>
      {disabled ? null : (
        <div className="relative">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Пошук виконавця…"
            className="h-8 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          {q.trim() || available.length ? (
            <ul
              className={cn(
                "absolute z-20 mt-1 max-h-40 w-full overflow-auto rounded-md border border-zinc-200 bg-white text-sm shadow dark:border-zinc-700 dark:bg-zinc-900",
                !q.trim() && "hidden focus-within:block",
              )}
            >
              {(q.trim() ? available : available.slice(0, 8)).map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    onClick={() => {
                      onChange([...value, u.id]);
                      setQ("");
                    }}
                  >
                    <Avatar name={u.name} />
                    <span>{u.name}</span>
                    {u.login ? (
                      <span className="text-xs text-zinc-400">@{u.login}</span>
                    ) : null}
                  </button>
                </li>
              ))}
              {q.trim() && !available.length ? (
                <li className="px-2 py-1.5 text-xs text-zinc-400">Нікого не знайдено</li>
              ) : null}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}
