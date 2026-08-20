"use client";

import { useState } from "react";

export function LabelPicker({
  value,
  suggestions,
  onChange,
  disabled,
}: {
  value: string[];
  suggestions?: string[];
  onChange: (labels: string[]) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const lower = new Set(value.map((v) => v.toLowerCase()));
  const hints = (suggestions || []).filter(
    (s) => s && !lower.has(s.toLowerCase()) && s.toLowerCase().includes(draft.toLowerCase()),
  );

  function add(raw: string) {
    const label = raw.trim();
    if (!label) return;
    if (lower.has(label.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...value, label]);
    setDraft("");
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {value.map((label) => (
          <span
            key={label}
            className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800"
          >
            {label}
            {disabled ? null : (
              <button
                type="button"
                className="text-zinc-400 hover:text-zinc-700"
                onClick={() => onChange(value.filter((l) => l !== label))}
                aria-label={`Прибрати ${label}`}
              >
                ×
              </button>
            )}
          </span>
        ))}
      </div>
      {disabled ? null : (
        <div>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(draft);
              }
            }}
            placeholder="Мітка + Enter"
            className="h-8 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          {draft && hints.length ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {hints.slice(0, 6).map((h) => (
                <button
                  key={h}
                  type="button"
                  className="rounded-md border border-zinc-200 px-2 py-0.5 text-[11px] hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  onClick={() => add(h)}
                >
                  {h}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
