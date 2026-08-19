"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
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
};

type Sprint = {
  id: string;
  name: string;
  status: string;
  goal: string | null;
};

function SortableRow({
  issue,
  projectId,
  canEdit,
  activeSprintId,
}: {
  issue: Issue;
  projectId: string;
  canEdit: boolean;
  activeSprintId?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: issue.id });
  const [, startTransition] = useTransition();
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
            href={`/projects/${projectId}/issues/${issue.id}`}
            className="text-sm font-medium text-sky-600"
          >
            {issue.key}
          </Link>
          <p className="text-sm">{issue.title}</p>
          <p className="text-[11px] uppercase text-zinc-400">{issue.type}</p>
        </div>
      </div>
      {canEdit && activeSprintId ? (
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            startTransition(async () => {
              await assignToSprintAction(issue.id, activeSprintId);
              window.location.reload();
            })
          }
        >
          У спринт
        </Button>
      ) : null}
    </div>
  );
}

export function BacklogClient({
  projectId,
  backlog,
  sprints,
  canManage,
  canEdit,
}: {
  projectId: string;
  backlog: Issue[];
  sprints: Sprint[];
  canManage: boolean;
  canEdit: boolean;
}) {
  const [items, setItems] = useState(backlog);
  const [, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  const active = sprints.find((s) => s.status === "active");
  const future = sprints.filter((s) => s.status === "future");
  const ids = useMemo(() => items.map((i) => i.id), [items]);

  function onDragEnd(event: DragEndEvent) {
    const { active: a, over } = event;
    if (!over || a.id === over.id || !canEdit) return;
    const oldIndex = items.findIndex((i) => i.id === a.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    startTransition(async () => {
      await reorderBacklogAction(next.map((i) => i.id));
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-2">
        <h2 className="font-semibold">Backlog ({items.length})</h2>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {items.map((issue) => (
                <SortableRow
                  key={issue.id}
                  issue={issue}
                  projectId={projectId}
                  canEdit={canEdit}
                  activeSprintId={active?.id}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      <div className="space-y-4">
        {active ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
            <h3 className="font-semibold">Активний: {active.name}</h3>
            {active.goal ? <p className="text-sm text-zinc-600">{active.goal}</p> : null}
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
                  <option value="backlog">Backlog</option>
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
                      window.location.reload();
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
    </div>
  );
}
