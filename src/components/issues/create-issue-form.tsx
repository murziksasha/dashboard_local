"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { createIssueAction } from "@/app/actions/issues";
import { AssigneePicker } from "@/components/issues/assignee-picker";
import { MarkdownEditor } from "@/components/issues/markdown-editor";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { ISSUE_TYPE_LABELS, PRIORITY_LABELS } from "@/lib/types";

export function CreateIssueForm({
  projectId,
  statuses,
  users,
  sprints,
  epics,
  defaultSprintId,
  templates,
}: {
  projectId: string;
  statuses: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string; login?: string }>;
  sprints: Array<{ id: string; name: string }>;
  epics: Array<{ id: string; key: string; title: string }>;
  defaultSprintId?: string;
  templates?: Array<{
    id: string;
    name: string;
    type: string;
    title: string | null;
    description: string | null;
    priority: string;
    labels: string | null;
  }>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [type, setType] = useState("task");
  const [priority, setPriority] = useState("medium");
  const [labels, setLabels] = useState("");
  const [dupes, setDupes] = useState<Array<{ id: string; key: string; title: string }>>([]);

  function close() {
    setOpen(false);
    setMore(false);
    setError(null);
    setAssigneeIds([]);
    setTitle("");
    setDesc("");
    setType("task");
    setPriority("medium");
    setLabels("");
    setDupes([]);
  }

  useEffect(() => {
    const q = title.trim();
    if (q.length < 4) {
      setDupes([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { issues?: Array<{ id: string; key: string; title: string; project_id: string }> };
        setDupes((data.issues || []).filter((i) => i.project_id === projectId).slice(0, 4));
      } catch {
        // ignore
      }
    }, 250);
    return () => clearTimeout(t);
  }, [title, projectId]);

  function applyTemplate(id: string) {
    const tpl = templates?.find((x) => x.id === id);
    if (!tpl) return;
    if (tpl.title) setTitle(tpl.title);
    if (tpl.description) setDesc(tpl.description);
    if (tpl.type) setType(tpl.type);
    if (tpl.priority) setPriority(tpl.priority);
    if (tpl.labels) setLabels(tpl.labels);
    setMore(true);
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
                toast.push("Задачу створено");
                close();
                router.refresh();
              }
            });
          }}
        >
          {templates?.length ? (
            <div className="space-y-1">
              <Label>Шаблон</Label>
              <Select defaultValue="" onChange={(e) => applyTemplate(e.target.value)}>
                <option value="">—</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          <div className="space-y-1">
            <Label>Заголовок</Label>
            <Input name="title" required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
            {dupes.length ? (
              <ul className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs dark:border-amber-900 dark:bg-amber-950/40">
                <li className="mb-1 font-medium">Схожі задачі:</li>
                {dupes.map((d) => (
                  <li key={d.id}>
                    {d.key} — {d.title}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Тип</Label>
              <Select name="type" value={type} onChange={(e) => setType(e.target.value)}>
                {Object.entries(ISSUE_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Пріоритет</Label>
              <Select name="priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
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
                <input type="hidden" name="description" value={desc} />
                <MarkdownEditor value={desc} onChange={setDesc} rows={5} split />
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
                <Input name="labels" placeholder="ui, backend" value={labels} onChange={(e) => setLabels(e.target.value)} />
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
