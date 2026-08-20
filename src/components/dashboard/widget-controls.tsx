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
  reorderWidgetsAction,
  toggleWidgetAction,
} from "@/app/actions/dashboard";
import { Button } from "@/components/ui/button";
import { widgetTitle } from "@/lib/dashboard-widget-meta";

type Item = {
  id: string;
  widget_type: string;
  enabled: number;
  position: number;
};

function Row({
  item,
  scope,
}: {
  item: Item;
  scope: "personal" | "project";
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id });
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
      className="flex items-center justify-between gap-2 rounded-md border border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-800"
    >
      <div className="flex items-center gap-2">
        <button type="button" className="cursor-grab text-zinc-400" {...attributes} {...listeners}>
          ⋮⋮
        </button>
        <span>{widgetTitle(item.widget_type, scope)}</span>
      </div>
      <Button
        type="button"
        size="sm"
        variant={item.enabled ? "secondary" : "outline"}
        onClick={() =>
          startTransition(async () => {
            await toggleWidgetAction(item.id, !item.enabled);
            router.refresh();
          })
        }
      >
        {item.enabled ? "Увімкнено" : "Вимкнено"}
      </Button>
    </div>
  );
}

export function WidgetControls({
  initial,
  scope,
  projectId,
}: {
  initial: Item[];
  scope: "personal" | "project";
  projectId?: string;
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
      await reorderWidgetsAction(
        next.map((i) => i.id),
        scope,
        projectId,
      );
    });
  }

  return (
    <div className="space-y-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="text-sm font-semibold">Віджети дашборду</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {items.map((item) => (
              <Row key={item.id} item={item} scope={scope} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
