"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addCommentAction,
  addIssueLinkAction,
  addWorklogAction,
  createSubtaskAction,
  deleteIssueAction,
  toggleWatcherAction,
  updateIssueAction,
  uploadAttachmentAction,
} from "@/app/actions/issues";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ISSUE_TYPE_LABELS, PRIORITY_LABELS } from "@/lib/types";

export function IssueDetailClient(props: {
  issue: {
    id: string;
    project_id: string;
    key: string;
    title: string;
    description: string | null;
    type: string;
    priority: string;
    status_id: string;
    assignee_id: string | null;
    epic_id: string | null;
    sprint_id: string | null;
    story_points: number | null;
    original_estimate_sec: number | null;
    remaining_estimate_sec: number | null;
    start_date: string | null;
    due_date: string | null;
  };
  labels: string[];
  assigneeIds: string[];
  statuses: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string }>;
  sprints: Array<{ id: string; name: string }>;
  epics: Array<{ id: string; key: string; title: string }>;
  customFields: Array<{
    id: string;
    name: string;
    field_type: string;
    options_json: string | null;
    value: string | null;
  }>;
  watching: boolean;
  canEdit: boolean;
  canComment: boolean;
}) {
  const router = useRouter();
  const { issue } = props;
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [descPreview, setDescPreview] = useState(issue.description || "");

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
      <div className="space-y-4">
        <form
          className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          onSubmit={(e) => {
            e.preventDefault();
            if (!props.canEdit) return;
            const fd = new FormData(e.currentTarget);
            fd.set("issueId", issue.id);
            startTransition(async () => {
              const res = await updateIssueAction(fd);
              setMsg(res?.error || "Збережено");
              if (!res?.error) window.location.reload();
            });
          }}
        >
          <div className="space-y-1">
            <Label>Заголовок</Label>
            <Input name="title" defaultValue={issue.title} disabled={!props.canEdit} />
          </div>
          <div className="space-y-1">
            <Label>Опис (Markdown)</Label>
            <Textarea
              name="description"
              rows={8}
              defaultValue={issue.description || ""}
              disabled={!props.canEdit}
              onChange={(e) => setDescPreview(e.target.value)}
            />
            <div className="rounded-md border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
              <p className="mb-1 text-xs font-semibold uppercase text-zinc-400">Перегляд</p>
              <Markdown content={descPreview} />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Тип</Label>
              <Select name="type" defaultValue={issue.type} disabled={!props.canEdit}>
                {Object.entries(ISSUE_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Пріоритет</Label>
              <Select
                name="priority"
                defaultValue={issue.priority}
                disabled={!props.canEdit}
              >
                {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Статус</Label>
              <Select
                name="statusId"
                defaultValue={issue.status_id}
                disabled={!props.canEdit}
              >
                {props.statuses.map((s) => (
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
                disabled={!props.canEdit}
                defaultValue={props.assigneeIds || []}
                className="min-h-[90px] w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950"
              >
                {props.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Початок</Label>
              <Input
                name="start_date"
                type="date"
                defaultValue={issue.start_date || ""}
                disabled={!props.canEdit}
              />
            </div>
            <div className="space-y-1">
              <Label>Спринт</Label>
              <Select
                name="sprintId"
                defaultValue={issue.sprint_id || ""}
                disabled={!props.canEdit}
              >
                <option value="">Backlog</option>
                {props.sprints.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Epic</Label>
              <Select
                name="epicId"
                defaultValue={issue.epic_id || ""}
                disabled={!props.canEdit}
              >
                <option value="">Без epic</option>
                {props.epics.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.key} — {e.title}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Story points</Label>
              <Input
                name="story_points"
                type="number"
                defaultValue={issue.story_points ?? ""}
                disabled={!props.canEdit}
              />
            </div>
            <div className="space-y-1">
              <Label>Дедлайн</Label>
              <Input
                name="due_date"
                type="date"
                defaultValue={issue.due_date || ""}
                disabled={!props.canEdit}
              />
            </div>
            <div className="space-y-1">
              <Label>Оцінка (секунди)</Label>
              <Input
                name="original_estimate_sec"
                type="number"
                defaultValue={issue.original_estimate_sec ?? ""}
                disabled={!props.canEdit}
              />
            </div>
            <div className="space-y-1">
              <Label>Залишок (секунди)</Label>
              <Input
                name="remaining_estimate_sec"
                type="number"
                defaultValue={issue.remaining_estimate_sec ?? ""}
                disabled={!props.canEdit}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Мітки (через кому)</Label>
              <Input
                name="labels"
                defaultValue={props.labels.join(", ")}
                disabled={!props.canEdit}
              />
            </div>
            {props.customFields.map((field) => (
              <div key={field.id} className="space-y-1">
                <Label>{field.name}</Label>
                {field.field_type === "select" ? (
                  <Select
                    name={`cf_${field.id}`}
                    defaultValue={field.value || ""}
                    disabled={!props.canEdit}
                  >
                    <option value="">—</option>
                    {(JSON.parse(field.options_json || "[]") as string[]).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    name={`cf_${field.id}`}
                    type={
                      field.field_type === "number"
                        ? "number"
                        : field.field_type === "date"
                          ? "date"
                          : "text"
                    }
                    defaultValue={field.value || ""}
                    disabled={!props.canEdit}
                  />
                )}
              </div>
            ))}
          </div>
          {props.canEdit ? (
            <Button type="submit" disabled={pending}>
              Зберегти
            </Button>
          ) : null}
          {msg ? <p className="text-sm text-zinc-500">{msg}</p> : null}
        </form>

        {props.canComment ? (
          <form
            className="space-y-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              fd.set("issueId", issue.id);
              startTransition(async () => {
                await addCommentAction(fd);
                window.location.reload();
              });
            }}
          >
            <Label>Коментар (можна @login)</Label>
            <Textarea name="body" required rows={3} />
            <Button type="submit" size="sm">
              Додати коментар
            </Button>
          </form>
        ) : null}
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              startTransition(async () => {
                await toggleWatcherAction(issue.id);
                window.location.reload();
              })
            }
          >
            {props.watching ? "Не стежити" : "Стежити"}
          </Button>
        </div>

        {props.canEdit ? (
          <>
            <form
              className="space-y-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                fd.set("fromIssueId", issue.id);
                startTransition(async () => {
                  await addIssueLinkAction(fd);
                  window.location.reload();
                });
              }}
            >
              <h3 className="font-semibold">Звʼязок</h3>
              <Select name="linkType" defaultValue="relates">
                <option value="blocks">blocks</option>
                <option value="is_blocked_by">is blocked by</option>
                <option value="relates">relates to</option>
                <option value="duplicates">duplicates</option>
              </Select>
              <Input name="toKey" placeholder="DEMO-2" required />
              <Button type="submit" size="sm">
                Додати звʼязок
              </Button>
            </form>

            <form
              className="space-y-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                fd.set("issueId", issue.id);
                const minutes = Number(fd.get("minutes") || 0);
                fd.set("seconds", String(minutes * 60));
                startTransition(async () => {
                  await addWorklogAction(fd);
                  window.location.reload();
                });
              }}
            >
              <h3 className="font-semibold">Облік часу</h3>
              <Input name="minutes" type="number" min={1} placeholder="Хвилини" required />
              <Input name="work_date" type="date" />
              <Input name="note" placeholder="Нотатка" />
              <Button type="submit" size="sm">
                Залоговати
              </Button>
            </form>

            <form
              className="space-y-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                fd.set("issueId", issue.id);
                startTransition(async () => {
                  const res = await uploadAttachmentAction(fd);
                  if (res?.error) setMsg(res.error);
                  else window.location.reload();
                });
              }}
            >
              <h3 className="font-semibold">Вкладення (до 25 МБ)</h3>
              <Input name="file" type="file" required />
              <Button type="submit" size="sm">
                Завантажити
              </Button>
            </form>

            {issue.type !== "subtask" ? (
              <form
                className="space-y-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  fd.set("parentId", issue.id);
                  startTransition(async () => {
                    const res = await createSubtaskAction(fd);
                    if (res?.error) setMsg(res.error);
                    else window.location.reload();
                  });
                }}
              >
                <h3 className="font-semibold">Підзадача</h3>
                <Input name="title" placeholder="Назва підзадачі" required />
                <Button type="submit" size="sm">
                  Створити sub-task
                </Button>
              </form>
            ) : null}

            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={pending}
              onClick={() => {
                if (!confirm(`Видалити ${issue.key}?`)) return;
                startTransition(async () => {
                  const res = await deleteIssueAction(issue.id);
                  if (res?.error) setMsg(res.error);
                  else if (res?.projectId) router.push(`/projects/${res.projectId}`);
                });
              }}
            >
              Видалити задачу
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
