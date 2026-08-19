"use client";

import { useState, useTransition } from "react";
import { createIssueAction } from "@/app/actions/issues";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ISSUE_TYPE_LABELS, PRIORITY_LABELS } from "@/lib/types";

export function CreateIssueForm({
  projectId,
  statuses,
  users,
  sprints,
  epics,
  defaultSprintId,
}: {
  projectId: string;
  statuses: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string }>;
  sprints: Array<{ id: string; name: string }>;
  epics: Array<{ id: string; key: string; title: string }>;
  defaultSprintId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        Нова задача
      </Button>
    );
  }

  return (
    <form
      className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("projectId", projectId);
        setError(null);
        startTransition(async () => {
          const res = await createIssueAction(fd);
          if (res?.error) setError(res.error);
          else {
            setOpen(false);
            window.location.reload();
          }
        });
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Створити задачу</h3>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Закрити
        </Button>
      </div>
      <input type="hidden" name="projectId" value={projectId} />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1 md:col-span-2">
          <Label>Заголовок</Label>
          <Input name="title" required />
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label>Опис</Label>
          <Textarea name="description" rows={3} />
        </div>
        <div className="space-y-1">
          <Label>Тип</Label>
          <Select name="type" defaultValue="task">
            {Object.entries(ISSUE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Пріоритет</Label>
          <Select name="priority" defaultValue="medium">
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Статус</Label>
          <Select name="statusId" defaultValue={statuses[0]?.id}>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label>Виконавці (Ctrl/Cmd для кількох)</Label>
          <select
            name="assigneeIds"
            multiple
            className="min-h-[90px] w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label>Початок</Label>
          <Input name="start_date" type="date" />
        </div>
        <div className="space-y-1">
          <Label>Спринт</Label>
          <Select name="sprintId" defaultValue={defaultSprintId || ""}>
            <option value="">Backlog</option>
            {sprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Epic</Label>
          <Select name="epicId" defaultValue="">
            <option value="">Без epic</option>
            {epics.map((e) => (
              <option key={e.id} value={e.id}>
                {e.key} — {e.title}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Story points</Label>
          <Input name="story_points" type="number" min={0} step={0.5} />
        </div>
        <div className="space-y-1">
          <Label>Дедлайн</Label>
          <Input name="due_date" type="date" />
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label>Мітки (через кому)</Label>
          <Input name="labels" placeholder="ui, backend" />
        </div>
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Створення..." : "Створити"}
      </Button>
    </form>
  );
}
