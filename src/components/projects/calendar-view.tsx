"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateIssueAction } from "@/app/actions/issues";
import { useIssueDrawer } from "@/components/issues/issue-drawer";
import { cn } from "@/lib/utils";

export type CalendarIssue = {
  id: string;
  key: string;
  title: string;
  due_date: string;
};

export function CalendarView({
  projectId,
  year,
  month,
  issues,
  canEdit,
}: {
  projectId: string;
  year: number;
  month: number;
  issues: CalendarIssue[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const openIssue = useIssueDrawer();
  const [, startTransition] = useTransition();
  const [local, setLocal] = useState(issues);

  const first = new Date(year, month, 1);
  const startWeekday = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);

  const byDay: Record<string, CalendarIssue[]> = {};
  for (const i of local) {
    const d = i.due_date.slice(0, 10);
    (byDay[d] ??= []).push(i);
  }

  const cells: Array<{ day: number | null; date: string | null }> = [];
  for (let i = 0; i < startWeekday; i++) cells.push({ day: null, date: null });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      day: d,
      date: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    });
  }

  const prev = new Date(year, month - 1, 1);
  const next = new Date(year, month + 1, 1);
  const href = (y: number, m: number) =>
    `/projects/${projectId}/calendar?ym=${y}-${String(m + 1).padStart(2, "0")}`;

  function moveTo(issueId: string, date: string) {
    if (!canEdit) return;
    setLocal((prevIssues) =>
      prevIssues.map((i) => (i.id === issueId ? { ...i, due_date: date } : i)),
    );
    const fd = new FormData();
    fd.set("issueId", issueId);
    fd.set("due_date", date);
    startTransition(async () => {
      await updateIssueAction(fd);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <a
          href={href(prev.getFullYear(), prev.getMonth())}
          className="rounded-md border border-zinc-200 px-3 py-1 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          ← {prev.toLocaleDateString("uk-UA", { month: "long" })}
        </a>
        <p className="text-sm font-medium capitalize">
          {first.toLocaleDateString("uk-UA", { month: "long", year: "numeric" })}
        </p>
        <a
          href={href(next.getFullYear(), next.getMonth())}
          className="rounded-md border border-zinc-200 px-3 py-1 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {next.toLocaleDateString("uk-UA", { month: "long" })} →
        </a>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"].map((d) => (
          <div key={d} className="bg-zinc-50 p-2 text-center text-xs font-semibold dark:bg-zinc-900">
            {d}
          </div>
        ))}
        {cells.map((c, idx) => (
          <div
            key={idx}
            className={cn(
              "min-h-24 bg-white p-1 dark:bg-zinc-950",
              c.date === today && "bg-sky-50 dark:bg-sky-950/30",
            )}
            onDragOver={(e) => {
              if (canEdit && c.date) e.preventDefault();
            }}
            onDrop={(e) => {
              if (!canEdit || !c.date) return;
              e.preventDefault();
              const id = e.dataTransfer.getData("text/issue-id");
              if (id) moveTo(id, c.date);
            }}
          >
            {c.day ? <p className="text-xs text-zinc-400">{c.day}</p> : null}
            {c.date && byDay[c.date]
              ? byDay[c.date].slice(0, 4).map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    draggable={canEdit}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/issue-id", i.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => openIssue(i.id)}
                    className="mt-0.5 block w-full truncate rounded bg-sky-50 px-1 text-left text-[11px] text-sky-800 hover:bg-sky-100 dark:bg-sky-950 dark:text-sky-200"
                    title={i.title}
                  >
                    {i.key} {i.title}
                  </button>
                ))
              : null}
            {c.date && (byDay[c.date]?.length || 0) > 4 ? (
              <p className="px-1 text-[10px] text-zinc-400">+{byDay[c.date].length - 4}</p>
            ) : null}
          </div>
        ))}
      </div>
      {canEdit ? (
        <p className="text-xs text-zinc-500">Перетягніть задачу на інший день, щоб змінити дедлайн.</p>
      ) : null}
    </div>
  );
}
