"use client";

import { useRef } from "react";
import { Markdown } from "@/components/markdown";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const SNIPPETS: Array<{ label: string; wrap: [string, string] }> = [
  { label: "B", wrap: ["**", "**"] },
  { label: "I", wrap: ["_", "_"] },
  { label: "</>", wrap: ["`", "`"] },
  { label: "Link", wrap: ["[", "](url)"] },
  { label: "Img", wrap: ["![", "](url)"] },
  { label: "List", wrap: ["- ", ""] },
];

export function MarkdownEditor({
  value,
  onChange,
  rows = 8,
  split,
}: {
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  split?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function apply(wrap: [string, string]) {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || "text";
    const inserted = `${wrap[0]}${selected}${wrap[1]}`;
    const next = `${value.slice(0, start)}${inserted}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      if (!ref.current) return;
      ref.current.focus();
      const selStart = start + wrap[0].length;
      ref.current.setSelectionRange(selStart, selStart + selected.length);
    });
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {SNIPPETS.map((s) => (
          <button
            key={s.label}
            type="button"
            className="rounded border border-zinc-200 px-2 py-0.5 text-[11px] font-medium dark:border-zinc-700"
            onClick={() => apply(s.wrap)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className={cn(split && "grid gap-2 md:grid-cols-2")}>
        <Textarea ref={ref} value={value} rows={rows} onChange={(e) => onChange(e.target.value)} />
        {split ? (
          <div className="max-h-80 overflow-auto rounded-md border border-zinc-200 p-2 dark:border-zinc-800">
            <Markdown content={value} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
