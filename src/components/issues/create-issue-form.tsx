"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createIssueAction } from "@/app/actions/issues";
import { AssigneePicker } from "@/components/issues/assignee-picker";
import { Dialog } from "@/components/ui/dialog";
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
  users: Array<{ id: string; name: string; login?: string }>;
  sprints: Array<{ id: string; name: string }>;
  epics: Array<{ id: string; key: string; title: string }>;
  defaultSprintId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);

  function close() {
    setOpen(false);
    setMore(false);
    setError(null);
    setAssigneeIds([]);
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Нова задача
      </Button>
      <Dialog open={open} onClose={close} title="Створити задачу" className="max-w-xl">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("projectId", projectId);
            assigneeIds.forEach((id) => fd.append("assigneeIds", id));
            setError(null);
            startTransition(async () => {
              const res = await createIssueAction(fd);
              if (res?.error) setError(res.error);
              else {
                close();
                router.refresh();
              }
            });
          }}
        >
          <div className="space-y-1">
            <Label>Заголовок</Label>
            <Input name="title" required autoFocus />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
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
          </div>
          <div className="space-y-1">
            <Label>Виконавці</Label>
            <AssigneePicker users={users} value={assigneeIds} onChange={setAssigneeIds} />
          </div>
          {more ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label>Опис</Label>
                <Textarea name="description" rows={3} />
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
              <div className="space-y-1">
                <Label>Спринт</Label>
                <Select name="sprintId" defaultValue={defaultSprintId || ""}>
                  <option value="">Беклог</option>
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
                <Label>Початок</Label>
                <Input name="start_date" type="date" />
              </div>
              <div className="space-y-1">
                <Label>Дедлайн</Label>
                <Input name="due_date" type="date" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Мітки (через кому)</Label>
                <Input name="labels" placeholder="ui, backend" />
              </div>
            </div>
          ) : (
            <>
              <input type="hidden" name="statusId" value={statuses[0]?.id || ""} />
              <input type="hidden" name="sprintId" value={defaultSprintId || ""} />
            </>
          )}
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              className="text-xs text-sky-600 hover:underline"
              onClick={() => setMore((v) => !v)}
            >
              {more ? "Менше полів" : "Ще поля"}
            </button>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={close}>
                Скасувати
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Створення..." : "Створити"}
              </Button>
            </div>
          </div>
        </form>
      </Dialog>
    </>
  );
}
