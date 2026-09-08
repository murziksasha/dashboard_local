"use client";

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
  function apply(wrap: [string, string]) {
    onChange(`${value}${value && !value.endsWith("\n") ? "\n" : ""}${wrap[0]}text${wrap[1]}`);
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
        <Textarea value={value} rows={rows} onChange={(e) => onChange(e.target.value)} />
        {split ? (
          <div className="max-h-80 overflow-auto rounded-md border border-zinc-200 p-2 dark:border-zinc-800">
            <Markdown content={value} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
