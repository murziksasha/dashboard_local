"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
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
import { moveIssueAction } from "@/app/actions/issues";
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
};

export type BoardStatus = {
  id: string;
  name: string;
  category: string;
  wip_limit: number | null;
};

export type SwimlaneMode = "none" | "assignee" | "epic";

function IssueCard({
  issue,
  projectId,
  dragging,
}: {
  issue: BoardIssue;
  projectId: string;
  dragging?: boolean;
}) {
  return (
    <Link
      href={`/projects/${projectId}/issues/${issue.id}`}
      className={cn(
        "block rounded-lg border border-zinc-200 bg-white p-3 shadow-sm hover:border-sky-300 dark:border-zinc-700 dark:bg-zinc-900",
        dragging && "opacity-50",
      )}
      onClick={(e) => {
        if (dragging) e.preventDefault();
      }}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-sky-600">{issue.key}</span>
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
      <p className="text-sm font-medium leading-snug">{issue.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
        <span className="uppercase">{issue.type}</span>
        <span>{issue.assignee_names || issue.assignee_name || "Не призначено"}</span>
        {issue.story_points != null ? <span>{issue.story_points} SP</span> : null}
      </div>
    </Link>
  );
}

function SortableIssue({
  issue,
  projectId,
}: {
  issue: BoardIssue;
  projectId: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: issue.id, data: { statusId: issue.status_id } });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <IssueCard issue={issue} projectId={projectId} dragging={isDragging} />
    </div>
  );
}

function Column({
  status,
  issues,
  projectId,
}: {
  status: BoardStatus;
  issues: BoardIssue[];
  projectId: string;
}) {
  const overWip = status.wip_limit != null && issues.length > status.wip_limit;
  return (
    <div
      className="flex w-72 shrink-0 flex-col rounded-xl border border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/40"
      data-status-id={status.id}
    >
      <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <div>
          <p className="text-sm font-semibold">{status.name}</p>
          <p className="text-[11px] text-zinc-500">
            {issues.length}
            {status.wip_limit != null ? ` / WIP ${status.wip_limit}` : ""}
          </p>
        </div>
        {overWip ? <Badge tone="rose">WIP</Badge> : null}
      </div>
      <SortableContext items={issues.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-[80px] flex-1 flex-col gap-2 p-2" data-droppable={status.id}>
          {issues.map((issue) => (
            <SortableIssue key={issue.id} issue={issue} projectId={projectId} />
          ))}
        </div>
      </SortableContext>
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
      const names = (issue.assignee_names || issue.assignee_name || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (!names.length) {
        map.get("none")!.issues.push(issue);
        continue;
      }
      // put card in first assignee lane (multi-assignee shown in card)
      const key = issue.assignee_id || names[0];
      const title = names.join(", ");
      if (!map.has(key)) map.set(key, { id: key, title, issues: [] });
      map.get(key)!.issues.push(issue);
    }
    return [...map.values()].filter((l) => l.issues.length || l.id === "none");
  }
  // epic
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

export function KanbanBoard({
  projectId,
  initialStatuses,
  initialIssues,
  boardVersion,
  canEdit,
}: {
  projectId: string;
  initialStatuses: BoardStatus[];
  initialIssues: BoardIssue[];
  boardVersion: number;
  canEdit: boolean;
}) {
  const [statuses] = useState(initialStatuses);
  const [issues, setIssues] = useState(initialIssues);
  const [version, setVersion] = useState(boardVersion);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [swimlane, setSwimlane] = useState<SwimlaneMode>("none");
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const lanes = useMemo(() => buildLanes(issues, swimlane), [issues, swimlane]);

  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/board-version/${projectId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { version: number };
        if (data.version !== version) window.location.reload();
      } catch {
        // ignore
      }
    }, 4000);
    return () => clearInterval(t);
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

    let targetStatusId =
      (over.data.current as { statusId?: string } | undefined)?.statusId || null;
    if (!targetStatusId) {
      const overIssue = issues.find((i) => i.id === over.id);
      targetStatusId = overIssue?.status_id ?? null;
    }
    if (statuses.some((s) => s.id === String(over.id))) {
      targetStatusId = String(over.id);
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

    setIssues((prev) =>
      prev.map((i) =>
        i.id === activeIssue.id ? { ...i, status_id: targetStatusId! } : i,
      ),
    );
    setVersion((v) => v + 1);

    startTransition(async () => {
      const res = await moveIssueAction({
        issueId: activeIssue.id,
        statusId: targetStatusId!,
        beforeId,
        afterId,
      });
      if (res && "error" in res && res.error) {
        alert(res.error);
        window.location.reload();
      }
    });
  }

  const activeIssue = issues.find((i) => i.id === activeId) || null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-zinc-500">Swimlanes:</span>
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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="space-y-4">
          {lanes.map((lane) => (
            <div key={lane.id} className="space-y-2">
              {lane.title ? (
                <h3 className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                  {lane.title}{" "}
                  <span className="font-normal text-zinc-400">({lane.issues.length})</span>
                </h3>
              ) : null}
              <div className="board-scroll flex gap-3 overflow-x-auto pb-2">
                {statuses.map((status) => (
                  <Column
                    key={`${lane.id}-${status.id}`}
                    status={status}
                    issues={lane.issues.filter((i) => i.status_id === status.id)}
                    projectId={projectId}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <DragOverlay>
          {activeIssue ? (
            <div className="w-72">
              <IssueCard issue={activeIssue} projectId={projectId} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
