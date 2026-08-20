"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
  addStatusAction,
  deleteStatusAction,
  reorderStatusesAction,
  updateStatusAction,
} from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type Status = {
  id: string;
  name: string;
  category: string;
  wip_limit: number | null;
};

function Row({
  status,
  projectId,
}: {
  status: Status;
  projectId: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: status.id });
  const [, startTransition] = useTransition();
  const router = useRouter();
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-zinc-200 p-2 dark:border-zinc-800"
    >
      <form
        className="grid gap-2 md:grid-cols-[auto_1fr_1fr_6rem_auto_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          fd.set("projectId", projectId);
          fd.set("statusId", status.id);
          startTransition(async () => {
            await updateStatusAction(fd);
            router.refresh();
          });
        }}
      >
        <button type="button" className="cursor-grab px-1" {...attributes} {...listeners}>
          ⋮⋮
        </button>
        <Input name="name" defaultValue={status.name} required />
        <Select name="category" defaultValue={status.category}>
          <option value="todo">todo</option>
          <option value="in_progress">in_progress</option>
          <option value="done">done</option>
        </Select>
        <Input
          name="wip_limit"
          type="number"
          min={1}
          placeholder="WIP"
          defaultValue={status.wip_limit ?? ""}
        />
        <Button type="submit" size="sm" variant="secondary">
          Зберегти
        </Button>
        <Button
          type="button"
          size="sm"
          variant="danger"
          onClick={() =>
            startTransition(async () => {
              try {
                await deleteStatusAction(projectId, status.id);
                router.refresh();
              } catch (e) {
                alert(e instanceof Error ? e.message : "Помилка");
              }
            })
          }
        >
          Видалити
        </Button>
      </form>
    </div>
  );
}

export function StatusManager({
  projectId,
  initial,
}: {
  projectId: string;
  initial: Status[];
}) {
  const [items, setItems] = useState(initial);
  const [, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    startTransition(async () => {
      await reorderStatusesAction(
        projectId,
        next.map((s) => s.id),
      );
    });
  }

  return (
    <div className="space-y-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map((s) => (
              <Row key={s.id} status={s} projectId={projectId} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <form
        className="grid gap-2 border-t border-zinc-200 pt-3 md:grid-cols-4 dark:border-zinc-800"
        action={addStatusAction}
      >
        <input type="hidden" name="projectId" value={projectId} />
        <Input name="name" placeholder="Новий статус" required />
        <Select name="category" defaultValue="todo">
          <option value="todo">todo</option>
          <option value="in_progress">in_progress</option>
          <option value="done">done</option>
        </Select>
        <Input name="wip_limit" type="number" min={1} placeholder="WIP (опц.)" />
        <Button type="submit" size="sm">
          Додати
        </Button>
      </form>
    </div>
  );
}
