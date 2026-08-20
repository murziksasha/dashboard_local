"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createIssueAction, moveIssueAction } from "@/app/actions/issues";
import { useIssueDrawer } from "@/components/issues/issue-drawer";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PRIORITY_LABELS, type Priority } from "@/lib/types";
import { cn } from "@/lib/utils";

export type BoardIssue = {
  id: string;
  key: string;
  title: string;
  type: string;
  priority: Priority;
  status_id: string;
  assignee_id?: string | null;
  assignee_name?: string | null;
  assignee_names?: string | null;
  epic_id?: string | null;
  epic_key?: string | null;
  epic_title?: string | null;
  labels?: string | null;
  story_points?: number | null;
  due_date?: string | null;
};

export type BoardStatus = {
  id: string;
  name: string;
  category: string;
  wip_limit: number | null;
};

export type SwimlaneMode = "none" | "assignee" | "epic";

const TYPE_CLASS: Record<string, string> = {
  epic: "bg-violet-500",
  story: "bg-emerald-500",
  task: "bg-sky-500",
  bug: "bg-rose-500",
  subtask: "bg-zinc-400",
};

function dueClass(due?: string | null): string {
  if (!due) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${due}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return "text-rose-600";
  if (diff <= 3) return "text-amber-600";
  return "text-zinc-500";
}

function assigneeList(issue: BoardIssue): string[] {
  const names = (issue.assignee_names || issue.assignee_name || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return names;
}

function IssueCard({
  issue,
  projectId,
  dragging,
  onOpen,
}: {
  issue: BoardIssue;
  projectId: string;
  dragging?: boolean;
  onOpen?: (id: string) => void;
}) {
  const people = assigneeList(issue);
  const labels = (issue.labels || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    <Link
      href={`/projects/${projectId}/issues/${issue.id}`}
      className={cn(
        "block rounded-lg border border-zinc-200 bg-white p-3 shadow-sm hover:border-sky-300 dark:border-zinc-700 dark:bg-zinc-900",
        dragging && "opacity-50",
      )}
      onClick={(e) => {
        if (dragging) {
          e.preventDefault();
          return;
        }
        if (!onOpen) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        onOpen(issue.id);
      }}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-sky-600">
          <span
            className={cn("size-2 rounded-full", TYPE_CLASS[issue.type] || "bg-zinc-400")}
            title={issue.type}
          />
          {issue.key}
        </span>
        <Badge
          tone={
            issue.priority === "highest" || issue.priority === "high"
              ? "rose"
              : issue.priority === "medium"
                ? "amber"
                : "default"
          }
        >
          {PRIORITY_LABELS[issue.priority]}
        </Badge>
      </div>
      <p className="line-clamp-2 text-sm font-medium leading-snug">{issue.title}</p>
      {labels.length ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {labels.slice(0, 2).map((l) => (
            <span
              key={l}
              className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {l}
            </span>
          ))}
          {labels.length > 2 ? (
            <span className="text-[10px] text-zinc-400">+{labels.length - 2}</span>
          ) : null}
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
        <span className="uppercase">{issue.type}</span>
        {issue.story_points != null ? <span>{issue.story_points} SP</span> : null}
        {issue.due_date ? (
          <span className={dueClass(issue.due_date)}>{issue.due_date}</span>
        ) : null}
        <span className="ml-auto flex -space-x-1">
          {people.slice(0, 3).map((n) => (
            <Avatar key={n} name={n} />
          ))}
          {people.length > 3 ? (
            <span className="text-[10px] text-zinc-400">+{people.length - 3}</span>
          ) : null}
          {!people.length ? <span>Не призначено</span> : null}
        </span>
      </div>
    </Link>
  );
}

function SortableIssue({
  issue,
  projectId,
  onOpen,
}: {
  issue: BoardIssue;
  projectId: string;
  onOpen?: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: issue.id,
      data: { statusId: issue.status_id, type: "issue" },
    });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style} className="flex gap-1">
      <button
        type="button"
        className="mt-3 h-6 w-3 shrink-0 cursor-grab touch-none text-zinc-300 hover:text-zinc-500"
        aria-label="Перетягнути"
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>
      <div className="min-w-0 flex-1">
        <IssueCard issue={issue} projectId={projectId} dragging={isDragging} onOpen={onOpen} />
      </div>
    </div>
  );
}

function Column({
  status,
  issues,
  projectId,
  laneId,
  canEdit,
  onQuickAdd,
  onOpen,
}: {
  status: BoardStatus;
  issues: BoardIssue[];
  projectId: string;
  laneId: string;
  canEdit: boolean;
  onQuickAdd: (statusId: string, title: string) => void;
  onOpen?: (id: string) => void;
}) {
  const droppableId = `${laneId}::${status.id}`;
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: { statusId: status.id, laneId, type: "column" },
  });
  const overWip = status.wip_limit != null && issues.length > status.wip_limit;
  const [draft, setDraft] = useState("");

  return (
    <div
      className={cn(
        "flex min-h-[140px] min-w-0 flex-col rounded-xl border border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/40",
        isOver && "ring-2 ring-sky-400",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <div>
          <p className="text-sm font-semibold">{status.name}</p>
          <p className="text-[11px] text-zinc-500">
            {issues.length}
            {status.wip_limit != null ? ` / WIP ${status.wip_limit}` : ""}
          </p>
        </div>
        {overWip ? (
          <Badge tone="rose" title="ліміт незавершеного">
            WIP
          </Badge>
        ) : null}
      </div>
      <SortableContext items={issues.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex min-h-[80px] flex-1 flex-col gap-2 p-2">
          {issues.map((issue) => (
            <SortableIssue
              key={issue.id}
              issue={issue}
              projectId={projectId}
              onOpen={onOpen}
            />
          ))}
        </div>
      </SortableContext>
      {canEdit ? (
        <form
          className="border-t border-zinc-200 p-2 dark:border-zinc-800"
          onSubmit={(e) => {
            e.preventDefault();
            const title = draft.trim();
            if (!title) return;
            setDraft("");
            onQuickAdd(status.id, title);
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onPointerDown={(e) => e.stopPropagation()}
            placeholder="Нова задача…"
            className="h-8 w-full rounded-md border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
          />
        </form>
      ) : null}
    </div>
  );
}

type Lane = { id: string; title: string; issues: BoardIssue[] };

function buildLanes(issues: BoardIssue[], mode: SwimlaneMode): Lane[] {
  if (mode === "none") {
    return [{ id: "all", title: "", issues }];
  }
  if (mode === "assignee") {
    const map = new Map<string, Lane>();
    map.set("none", { id: "none", title: "Не призначено", issues: [] });
    for (const issue of issues) {
      const names = assigneeList(issue);
      if (!names.length) {
        map.get("none")!.issues.push(issue);
        continue;
      }
      const key = issue.assignee_id || names[0];
      const title = names.join(", ");
      if (!map.has(key)) map.set(key, { id: key, title, issues: [] });
      map.get(key)!.issues.push(issue);
    }
    return [...map.values()].filter((l) => l.issues.length || l.id === "none");
  }
  const map = new Map<string, Lane>();
  map.set("none", { id: "none", title: "Без Epic", issues: [] });
  for (const issue of issues) {
    if (!issue.epic_id) {
      map.get("none")!.issues.push(issue);
      continue;
    }
    const title = issue.epic_key
      ? `${issue.epic_key} — ${issue.epic_title || "Epic"}`
      : issue.epic_id;
    if (!map.has(issue.epic_id)) {
      map.set(issue.epic_id, { id: issue.epic_id, title, issues: [] });
    }
    map.get(issue.epic_id)!.issues.push(issue);
  }
  return [...map.values()].filter((l) => l.issues.length || l.id === "none");
}

function placeIssue(
  list: BoardIssue[],
  item: BoardIssue,
  statusId: string,
  beforeId: string | null,
  afterId: string | null,
): BoardIssue[] {
  const moved = { ...item, status_id: statusId };
  const without = list.filter((i) => i.id !== item.id);
  if (afterId) {
    const idx = without.findIndex((i) => i.id === afterId);
    if (idx >= 0) {
      without.splice(idx, 0, moved);
      return without;
    }
  }
  if (beforeId) {
    const idx = without.findIndex((i) => i.id === beforeId);
    if (idx >= 0) {
      without.splice(idx + 1, 0, moved);
      return without;
    }
  }
  const last = [...without].reverse().find((i) => i.status_id === statusId);
  if (last) {
    const idx = without.findIndex((i) => i.id === last.id);
    without.splice(idx + 1, 0, moved);
    return without;
  }
  without.push(moved);
  return without;
}

export function KanbanBoard(props: {
  projectId: string;
  initialStatuses: BoardStatus[];
  initialIssues: BoardIssue[];
  boardVersion: number;
  canEdit: boolean;
  defaultSprintId?: string;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Дошка…</p>}>
      <KanbanBoardInner {...props} />
    </Suspense>
  );
}

function KanbanBoardInner({
  projectId,
  initialStatuses,
  initialIssues,
  boardVersion,
  canEdit,
  defaultSprintId,
}: {
  projectId: string;
  initialStatuses: BoardStatus[];
  initialIssues: BoardIssue[];
  boardVersion: number;
  canEdit: boolean;
  defaultSprintId?: string;
}) {
  const router = useRouter();
  const openIssue = useIssueDrawer();
  const [statuses] = useState(initialStatuses);
  const [issues, setIssues] = useState(initialIssues);
  const [version, setVersion] = useState(boardVersion);
  const [stale, setStale] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [swimlane, setSwimlane] = useState<SwimlaneMode>("none");
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const lanes = useMemo(() => buildLanes(issues, swimlane), [issues, swimlane]);

  useEffect(() => {
    setIssues(initialIssues);
    setVersion(boardVersion);
    setStale(false);
  }, [initialIssues, boardVersion]);

  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource(`/api/events?projectId=${projectId}`);
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as { type?: string };
          if (data.type === "board" || data.type === "issue") setStale(true);
        } catch {
          // ignore
        }
      };
    } catch {
      // ignore
    }
    const t = setInterval(async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/board-version/${projectId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { version: number };
        if (data.version !== version) setStale(true);
      } catch {
        // ignore
      }
    }, 30000);
    return () => {
      clearInterval(t);
      es?.close();
    };
  }, [projectId, version]);

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    if (!canEdit) return;
    const { active, over } = event;
    if (!over) return;
    const activeIssue = issues.find((i) => i.id === active.id);
    if (!activeIssue) return;

    const overData = over.data.current as
      | { statusId?: string; type?: string }
      | undefined;
    let targetStatusId = overData?.statusId || null;
    if (!targetStatusId && String(over.id).includes("::")) {
      targetStatusId = String(over.id).split("::")[1] ?? null;
    }
    if (!targetStatusId) {
      const overIssue = issues.find((i) => i.id === over.id);
      targetStatusId = overIssue?.status_id ?? null;
    }
    if (!targetStatusId) return;

    const columnIssues = issues.filter(
      (i) => i.status_id === targetStatusId && i.id !== activeIssue.id,
    );
    const overIndex = columnIssues.findIndex((i) => i.id === over.id);
    const beforeId =
      overIndex >= 0
        ? columnIssues[overIndex - 1]?.id ?? null
        : columnIssues.at(-1)?.id ?? null;
    const afterId = overIndex >= 0 ? columnIssues[overIndex]?.id ?? null : null;

    const snapshot = issues;
    setIssues(placeIssue(issues, activeIssue, targetStatusId, beforeId, afterId));
    setVersion((v) => v + 1);

    startTransition(async () => {
      const res = await moveIssueAction({
        issueId: activeIssue.id,
        statusId: targetStatusId!,
        beforeId,
        afterId,
      });
      if (res && "error" in res && res.error) {
        setIssues(snapshot);
        setVersion((v) => v - 1);
        setStale(true);
      }
    });
  }

  function onQuickAdd(statusId: string, title: string) {
    const tempId = `tmp_${Date.now()}`;
    const temp: BoardIssue = {
      id: tempId,
      key: "…",
      title,
      type: "task",
      priority: "medium",
      status_id: statusId,
    };
    setIssues((prev) => [...prev, temp]);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("projectId", projectId);
      fd.set("title", title);
      fd.set("statusId", statusId);
      fd.set("type", "task");
      if (defaultSprintId) fd.set("sprintId", defaultSprintId);
      const res = await createIssueAction(fd);
      if (res && "error" in res && res.error) {
        setIssues((prev) => prev.filter((i) => i.id !== tempId));
        return;
      }
      if (res && "id" in res && res.id) {
        setIssues((prev) =>
          prev.map((i) =>
            i.id === tempId ? { ...i, id: res.id, key: res.key || i.key } : i,
          ),
        );
        setVersion((v) => v + 1);
      }
    });
  }

  const activeIssue = issues.find((i) => i.id === activeId) || null;
  const colTemplate = `repeat(${statuses.length}, minmax(var(--board-col, 16rem), 18rem))`;

  return (
    <div className="space-y-3">
      {stale ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900 dark:bg-amber-950/40">
          <span>Дошку змінено. Оновіть, щоб побачити актуальний стан.</span>
          <button
            type="button"
            className="rounded-md bg-sky-600 px-3 py-1 text-xs font-medium text-white"
            onClick={() => router.refresh()}
          >
            Оновити
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-zinc-500">Смуги:</span>
        {(
          [
            ["none", "Немає"],
            ["assignee", "Виконавець"],
            ["epic", "Epic"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setSwimlane(value)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium",
              swimlane === value
                ? "bg-sky-600 text-white"
                : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {!issues.length ? (
        <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-6 text-sm text-zinc-500 dark:border-zinc-700">
          На дошці немає задач. Додайте назву внизу колонки або натисніть «Нова задача».
        </p>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="board-scroll overflow-x-auto pb-2">
          <div className="min-w-max space-y-4">
            {lanes.map((lane) => (
              <div key={lane.id} className="space-y-2">
                {lane.title ? (
                  <h3 className="sticky left-0 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                    {lane.title}{" "}
                    <span className="font-normal text-zinc-400">({lane.issues.length})</span>
                  </h3>
                ) : null}
                <div
                  className="kanban-grid grid gap-3"
                  style={{ gridTemplateColumns: colTemplate }}
                >
                  {statuses.map((status) => (
                    <Column
                      key={`${lane.id}-${status.id}`}
                      status={status}
                      issues={lane.issues.filter((i) => i.status_id === status.id)}
                      projectId={projectId}
                      laneId={lane.id}
                      canEdit={canEdit}
                      onQuickAdd={onQuickAdd}
                      onOpen={openIssue}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <DragOverlay>
          {activeIssue ? (
            <div className="w-72">
              <IssueCard issue={activeIssue} projectId={projectId} onOpen={openIssue} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
