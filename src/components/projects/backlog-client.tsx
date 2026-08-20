"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  assignToSprintAction,
  reorderBacklogAction,
} from "@/app/actions/issues";
import { useIssueDrawer } from "@/components/issues/issue-drawer";
import {
  completeSprintAction,
  createSprintAction,
  startSprintAction,
} from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Issue = {
  id: string;
  key: string;
  title: string;
  type: string;
  sprint_id: string | null;
  story_points: number | null;
  priority?: string;
  due_date?: string | null;
  assignee_name?: string | null;
};

type Sprint = {
  id: string;
  name: string;
  status: string;
  goal: string | null;
  start_date?: string | null;
  end_date?: string | null;
};

function SortableRow({
  issue,
  projectId,
  canEdit,
  onOpen,
}: {
  issue: Issue;
  projectId: string;
  canEdit: boolean;
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: issue.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex min-w-0 items-start gap-2">
        {canEdit ? (
          <button
            type="button"
            className="mt-1 cursor-grab text-zinc-400"
            {...attributes}
            {...listeners}
            aria-label="Перетягнути"
          >
            ⋮⋮
          </button>
        ) : null}
        <div>
          <Link
            href={`/projects/${projectId}/issues/${issue.id}?from=/projects/${projectId}/backlog`}
            className="text-sm font-medium text-sky-600"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              onOpen(issue.id);
            }}
          >
            {issue.key}
          </Link>
          <p className="text-sm">{issue.title}</p>
          <p className="text-[11px] text-zinc-400">
            {issue.type}
            {issue.story_points != null ? ` · ${issue.story_points} SP` : ""}
            {issue.assignee_name ? ` · ${issue.assignee_name}` : ""}
            {issue.due_date ? ` · ${issue.due_date}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

function DropList({
  id,
  title,
  extra,
  issues,
  projectId,
  canEdit,
  onOpen,
}: {
  id: string;
  title: string;
  extra?: string;
  issues: Issue[];
  projectId: string;
  canEdit: boolean;
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`space-y-2 rounded-xl border p-3 ${
        isOver ? "border-sky-400" : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <h2 className="font-semibold">
        {title}{" "}
        <span className="font-normal text-zinc-400">
          ({issues.length}
          {extra ? ` · ${extra}` : ""})
        </span>
      </h2>
      <SortableContext items={issues.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="min-h-[80px] space-y-2">
          {issues.length === 0 ? (
            <p className="text-sm text-zinc-500">Порожньо — перетягніть сюди.</p>
          ) : null}
          {issues.map((issue) => (
            <SortableRow
              key={issue.id}
              issue={issue}
              projectId={projectId}
              canEdit={canEdit}
              onOpen={onOpen}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

export function BacklogClient({
  projectId,
  backlog,
  sprintIssues = [],
  sprints,
  canManage,
  canEdit,
}: {
  projectId: string;
  backlog: Issue[];
  sprintIssues?: Issue[];
  sprints: Sprint[];
  canManage: boolean;
  canEdit: boolean;
}) {
  const [backlogItems, setBacklogItems] = useState(backlog);
  const [sprintItems, setSprintItems] = useState(sprintIssues);
  const [, startTransition] = useTransition();
  const openIssue = useIssueDrawer();
  const router = useRouter();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  const active = sprints.find((s) => s.status === "active");
  const future = sprints.filter((s) => s.status === "future");
  const spSum = sprintItems.reduce((n, i) => n + (i.story_points || 0), 0);

  function findList(id: string): "sprint" | "backlog" | null {
    if (sprintItems.some((i) => i.id === id)) return "sprint";
    if (backlogItems.some((i) => i.id === id)) return "backlog";
    if (id === "sprint-box") return "sprint";
    if (id === "backlog-box") return "backlog";
    return null;
  }

  function onDragEnd(event: DragEndEvent) {
    const { active: a, over } = event;
    if (!over || !canEdit) return;
    const from = findList(String(a.id));
    const to = findList(String(over.id));
    if (!from || !to) return;

    if (from === to) {
      const list = from === "sprint" ? sprintItems : backlogItems;
      const oldIndex = list.findIndex((i) => i.id === a.id);
      const newIndex = list.findIndex((i) => i.id === over.id);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const next = arrayMove(list, oldIndex, newIndex);
      if (from === "sprint") setSprintItems(next);
      else setBacklogItems(next);
      startTransition(async () => {
        await reorderBacklogAction(next.map((i) => i.id));
      });
      return;
    }

    const item =
      from === "sprint"
        ? sprintItems.find((i) => i.id === a.id)
        : backlogItems.find((i) => i.id === a.id);
    if (!item) return;
    const nextSprint =
      from === "sprint"
        ? sprintItems.filter((i) => i.id !== item.id)
        : [...sprintItems, { ...item, sprint_id: active?.id || item.sprint_id }];
    const nextBacklog =
      from === "backlog"
        ? backlogItems.filter((i) => i.id !== item.id)
        : [...backlogItems, { ...item, sprint_id: null }];
    setSprintItems(nextSprint);
    setBacklogItems(nextBacklog);
    startTransition(async () => {
      await assignToSprintAction(item.id, from === "backlog" ? active?.id || null : null);
    });
  }

  const allIds = useMemo(
    () => [...sprintItems.map((i) => i.id), ...backlogItems.map((i) => i.id)],
    [sprintItems, backlogItems],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className="space-y-4">
          {active ? (
            <DropList
              id="sprint-box"
              title={`Спринт: ${active.name}`}
              extra={`${spSum} SP`}
              issues={sprintItems}
              projectId={projectId}
              canEdit={canEdit}
              onOpen={openIssue}
            />
          ) : null}
          <DropList
            id="backlog-box"
            title="Беклог"
            issues={backlogItems}
            projectId={projectId}
            canEdit={canEdit}
            onOpen={openIssue}
          />
        </div>
      </DndContext>

      <div className="space-y-4">
        {active ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
            <h3 className="font-semibold">Активний: {active.name}</h3>
            {active.goal ? <p className="text-sm text-zinc-600">{active.goal}</p> : null}
            <p className="mt-1 text-xs text-zinc-500">
              {active.start_date || "?"} → {active.end_date || "?"} · {sprintItems.length} задач · {spSum} SP
            </p>
            {canManage ? (
              <form className="mt-3 space-y-2" action={completeSprintAction}>
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="sprintId" value={active.id} />
                <Label>Незавершені перенести в</Label>
                <select
                  name="moveTo"
                  className="h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  defaultValue="backlog"
                >
                  <option value="backlog">Беклог</option>
                  {future.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <Button type="submit" variant="danger" size="sm">
                  Завершити спринт
                </Button>
              </form>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-2">
          <h3 className="font-semibold">Майбутні спринти</h3>
          {future.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800"
            >
              <div>
                <p className="text-sm font-medium">{s.name}</p>
                {s.goal ? <p className="text-xs text-zinc-500">{s.goal}</p> : null}
              </div>
              {canManage ? (
                <Button
                  size="sm"
                  onClick={() =>
                    startTransition(async () => {
                      await startSprintAction(projectId, s.id);
                      router.refresh();
                    })
                  }
                >
                  Старт
                </Button>
              ) : null}
            </div>
          ))}
        </div>

        {canManage ? (
          <form
            action={createSprintAction}
            className="space-y-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <h3 className="font-semibold">Новий спринт</h3>
            <input type="hidden" name="projectId" value={projectId} />
            <div className="space-y-1">
              <Label>Назва</Label>
              <Input name="name" required placeholder="Спринт 2" />
            </div>
            <div className="space-y-1">
              <Label>Мета</Label>
              <Textarea name="goal" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Початок</Label>
                <Input name="start_date" type="date" />
              </div>
              <div className="space-y-1">
                <Label>Кінець</Label>
                <Input name="end_date" type="date" />
              </div>
            </div>
            <Button type="submit" size="sm">
              Створити
            </Button>
          </form>
        ) : null}
      </div>
      <span className="sr-only">{allIds.join(",")}</span>
    </div>
  );
}
