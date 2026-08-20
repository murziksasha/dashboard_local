"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { updateIssueAction } from "@/app/actions/issues";
import { cn } from "@/lib/utils";

export type GanttIssue = {
  id: string;
  key: string;
  title: string;
  type: string;
  start_date: string | null;
  due_date: string | null;
  epic_id: string | null;
  parent_id: string | null;
};

export type GanttLink = {
  from_issue_id: string;
  to_issue_id: string;
  link_type: string;
};

type Mode = "timeline" | "dependencies";

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s + (s.length === 10 ? "T00:00:00" : ""));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function GanttView({
  projectId,
  issues: initialIssues,
  links,
  canEdit,
}: {
  projectId: string;
  issues: GanttIssue[];
  links: GanttLink[];
  canEdit: boolean;
}) {
  const [mode, setMode] = useState<Mode>("timeline");
  const [issues, setIssues] = useState(initialIssues);
  const [dragging, setDragging] = useState<{
    id: string;
    mode: "move" | "resize";
    startX: number;
    origStart: Date;
    origEnd: Date;
  } | null>(null);
  const [, startTransition] = useTransition();
  const [dayWidth, setDayWidth] = useState(28);

  const range = useMemo(() => {
    const dates: Date[] = [];
    for (const i of issues) {
      const s = parseDate(i.start_date) || parseDate(i.due_date);
      const e = parseDate(i.due_date) || parseDate(i.start_date);
      if (s) dates.push(s);
      if (e) dates.push(e);
    }
    if (!dates.length) {
      const now = new Date();
      return { start: now, days: 30 };
    }
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    min.setDate(min.getDate() - 3);
    max.setDate(max.getDate() + 10);
    return { start: min, days: Math.max(21, daysBetween(min, max) + 1) };
  }, [issues]);

  const width = range.days * dayWidth;
  const blocks = useMemo(
    () => links.filter((l) => l.link_type === "blocks"),
    [links],
  );

  const undated = issues.filter((i) => !i.start_date && !i.due_date);
  const dated = issues.filter((i) => i.start_date || i.due_date);
  const todayOffset = daysBetween(range.start, new Date());

  const sorted = useMemo(() => {
    if (mode === "timeline") {
      return [...dated].sort((a, b) =>
        (a.start_date || a.due_date || "").localeCompare(
          b.start_date || b.due_date || "",
        ),
      );
    }
    return [...dated].sort((a, b) => {
      if (a.type === "epic" && b.type !== "epic") return -1;
      if (b.type === "epic" && a.type !== "epic") return 1;
      return a.key.localeCompare(b.key);
    });
  }, [dated, mode]);

  function commitDates(id: string, start: Date, end: Date) {
    if (end < start) end = start;
    const start_date = toIsoDate(start);
    const due_date = toIsoDate(end);
    setIssues((prev) =>
      prev.map((i) => (i.id === id ? { ...i, start_date, due_date } : i)),
    );
    const fd = new FormData();
    fd.set("issueId", id);
    fd.set("start_date", start_date);
    fd.set("due_date", due_date);
    startTransition(async () => {
      await updateIssueAction(fd);
    });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging || !canEdit) return;
    const deltaDays = Math.round((e.clientX - dragging.startX) / dayWidth);
    if (dragging.mode === "move") {
      const ns = addDays(dragging.origStart, deltaDays);
      const ne = addDays(dragging.origEnd, deltaDays);
      setIssues((prev) =>
        prev.map((i) =>
          i.id === dragging.id
            ? { ...i, start_date: toIsoDate(ns), due_date: toIsoDate(ne) }
            : i,
        ),
      );
    } else {
      const ne = addDays(dragging.origEnd, deltaDays);
      const safeEnd = ne < dragging.origStart ? dragging.origStart : ne;
      setIssues((prev) =>
        prev.map((i) =>
          i.id === dragging.id
            ? { ...i, due_date: toIsoDate(safeEnd) }
            : i,
        ),
      );
    }
  }

  function onPointerUp() {
    if (!dragging) return;
    const issue = issues.find((i) => i.id === dragging.id);
    if (issue) {
      const s =
        parseDate(issue.start_date) ||
        parseDate(issue.due_date) ||
        range.start;
      const e = parseDate(issue.due_date) || s;
      commitDates(issue.id, s, e);
    }
    setDragging(null);
  }

  return (
    <div
      className="space-y-3"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium",
            mode === "timeline"
              ? "bg-sky-600 text-white"
              : "bg-zinc-100 dark:bg-zinc-800",
          )}
          onClick={() => setMode("timeline")}
        >
          Timeline
        </button>
        <button
          type="button"
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium",
            mode === "dependencies"
              ? "bg-sky-600 text-white"
              : "bg-zinc-100 dark:bg-zinc-800",
          )}
          onClick={() => setMode("dependencies")}
        >
          Залежності
        </button>
        <button type="button" className="rounded-md bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800" onClick={() => setDayWidth(14)}>
          Тиждень
        </button>
        <button type="button" className="rounded-md bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800" onClick={() => setDayWidth(28)}>
          День
        </button>
        <button type="button" className="rounded-md bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800" onClick={() => setDayWidth(48)}>
          Крупно
        </button>
      </div>
      {undated.length ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-3 text-sm dark:border-zinc-700">
          <p className="mb-1 font-medium">Без дат</p>
          <div className="flex flex-wrap gap-2">
            {undated.map((i) => (
              <Link key={i.id} href={`/projects/${projectId}/issues/${i.id}`} className="text-sky-600">
                {i.key}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <div className="min-w-full" style={{ minWidth: 280 + width }}>
          <div className="flex border-b border-zinc-200 bg-zinc-50 text-xs dark:border-zinc-800 dark:bg-zinc-900">
            <div className="w-72 shrink-0 px-3 py-2 font-semibold">Задача</div>
            <div className="relative" style={{ width }}>
              {Array.from({ length: range.days }).map((_, i) => {
                const d = addDays(range.start, i);
                return (
                  <div
                    key={i}
                    className="absolute top-0 border-l border-zinc-200 px-0.5 py-2 dark:border-zinc-800"
                    style={{ left: i * dayWidth, width: dayWidth }}
                  >
                    {d.getDate()}
                  </div>
                );
              })}
              <div className="h-8" />
              {todayOffset >= 0 && todayOffset < range.days ? (
                <div
                  className="pointer-events-none absolute top-0 z-10 h-full w-px bg-rose-500"
                  style={{ left: todayOffset * dayWidth }}
                />
              ) : null}
            </div>
          </div>

          {sorted.map((issue) => {
            const start =
              parseDate(issue.start_date) ||
              parseDate(issue.due_date) ||
              range.start;
            const end = parseDate(issue.due_date) || start;
            const offset = Math.max(0, daysBetween(range.start, start));
            const span = Math.max(1, daysBetween(start, end) + 1);
            const deps = blocks.filter((b) => b.to_issue_id === issue.id);

            return (
              <div
                key={issue.id}
                className="flex border-b border-zinc-100 dark:border-zinc-900"
              >
                <div className="w-72 shrink-0 px-3 py-2 text-sm">
                  <Link
                    href={`/projects/${projectId}/issues/${issue.id}`}
                    className="font-medium text-sky-600"
                  >
                    {issue.key}
                  </Link>
                  <div className="truncate text-xs text-zinc-500">
                    {issue.title}
                  </div>
                  {mode === "dependencies" && deps.length ? (
                    <div className="text-[10px] text-amber-600">
                      blocked by:{" "}
                      {deps
                        .map(
                          (d) =>
                            issues.find((i) => i.id === d.from_issue_id)?.key,
                        )
                        .filter(Boolean)
                        .join(", ")}
                    </div>
                  ) : null}
                </div>
                <div className="relative h-12" style={{ width }}>
                  {Array.from({ length: range.days }).map((_, i) => (
                    <div
                      key={i}
                      className="absolute inset-y-0 border-l border-zinc-100 dark:border-zinc-900"
                      style={{ left: i * dayWidth }}
                    />
                  ))}
                  <div
                    className={cn(
                      "absolute top-2 flex h-6 items-stretch rounded-md text-[10px] text-white",
                      issue.type === "epic" ? "bg-violet-600" : "bg-sky-600",
                      mode === "dependencies" &&
                        deps.length &&
                        "ring-2 ring-amber-400",
                      canEdit && "cursor-grab active:cursor-grabbing",
                    )}
                    style={{
                      left: offset * dayWidth,
                      width: Math.max(dayWidth, span * dayWidth - 4),
                    }}
                    onPointerDown={(e) => {
                      if (!canEdit) return;
                      e.currentTarget.setPointerCapture(e.pointerId);
                      setDragging({
                        id: issue.id,
                        mode: "move",
                        startX: e.clientX,
                        origStart: start,
                        origEnd: end,
                      });
                    }}
                    title={`${issue.start_date || "?"} → ${issue.due_date || "?"}`}
                  >
                    <span className="flex-1 truncate px-2 leading-6">
                      {issue.key}
                    </span>
                    {canEdit ? (
                      <span
                        className="w-2 cursor-ew-resize rounded-r-md bg-black/20"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          e.currentTarget.setPointerCapture(e.pointerId);
                          setDragging({
                            id: issue.id,
                            mode: "resize",
                            startX: e.clientX,
                            origStart: start,
                            origEnd: end,
                          });
                        }}
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-zinc-500">
        {canEdit
          ? "Перетягніть смугу щоб змінити дати; правий край — зміна due date."
          : "Лише перегляд."}{" "}
        Dependencies = звʼязки <code>blocks</code>.
      </p>
    </div>
  );
}
