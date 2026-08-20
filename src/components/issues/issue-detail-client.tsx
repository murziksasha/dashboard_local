"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
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
import { AssigneePicker } from "@/components/issues/assignee-picker";
import { LabelPicker } from "@/components/issues/label-picker";
import { MentionTextarea } from "@/components/issues/mention-textarea";
import {
  AttachmentsPanel,
  CommentsPanel,
  LinksPanel,
  WorklogsPanel,
  type CommentRow,
} from "@/components/issues/issue-side-panels";
import { Markdown } from "@/components/markdown";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatActivity } from "@/lib/activity-format";
import { ISSUE_TYPE_LABELS, PRIORITY_LABELS } from "@/lib/types";
import { formatDuration } from "@/lib/utils";

type LinkRow = {
  id: string;
  link_type: string;
  other_key: string;
  other_id: string;
  other_title: string;
};

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
  labelSuggestions?: string[];
  assigneeIds: string[];
  statuses: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string; login?: string }>;
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
  comments?: CommentRow[];
  attachments?: Array<{
    id: string;
    filename: string;
    size_bytes: number;
    mime_type?: string | null;
  }>;
  links?: LinkRow[];
  worklogs?: Array<{
    id: string;
    seconds: number;
    work_date: string;
    note: string | null;
    name: string;
  }>;
  subtasks?: Array<{ id: string; key: string; title: string; status_name: string }>;
  activity?: Array<{
    id: string;
    action: string;
    created_at: string;
    name: string | null;
    payload_json?: string | null;
  }>;
  currentUserId?: string;
  currentUserName?: string;
  isAdmin?: boolean;
  compact?: boolean;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const { issue } = props;
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [title, setTitle] = useState(issue.title);
  const [desc, setDesc] = useState(issue.description || "");
  const [savedDesc, setSavedDesc] = useState(issue.description || "");
  const [descTab, setDescTab] = useState<"view" | "edit">("view");
  const [assigneeIds, setAssigneeIds] = useState(props.assigneeIds);
  const [labels, setLabels] = useState(props.labels);
  const [watching, setWatching] = useState(props.watching);
  const [comments, setComments] = useState(props.comments || []);
  const [attachments, setAttachments] = useState(props.attachments || []);
  const [links, setLinks] = useState(props.links || []);
  const [worklogs, setWorklogs] = useState(props.worklogs || []);
  const [subtasks, setSubtasks] = useState(props.subtasks || []);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [activityOpen, setActivityOpen] = useState(false);

  const dirty = desc !== savedDesc;
  useEffect(() => {
    function onLeave(e: BeforeUnloadEvent) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  function patch(fields: Record<string, string | string[]>) {
    if (!props.canEdit) return;
    const fd = new FormData();
    fd.set("issueId", issue.id);
    for (const [k, v] of Object.entries(fields)) {
      if (Array.isArray(v)) {
        if (v.length) v.forEach((item) => fd.append(k, item));
        else fd.set(k, "");
      } else fd.set(k, v);
    }
    startTransition(async () => {
      const res = await updateIssueAction(fd);
      setMsg(res?.error || "Збережено");
    });
  }

  function saveDescription() {
    patch({ description: desc });
    setSavedDesc(desc);
    setDescTab("view");
  }

  return (
    <div className={props.compact ? "space-y-4" : "grid gap-4 lg:grid-cols-[1.4fr_0.8fr]"}>
      <div className="space-y-4">
        <div className="space-y-2">
          <input
            value={title}
            disabled={!props.canEdit}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title.trim() && title !== issue.title) patch({ title: title.trim() });
            }}
            className="w-full bg-transparent text-xl font-bold leading-tight outline-none focus:ring-0 disabled:opacity-70"
          />
        </div>

        <div className="space-y-2 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Опис</p>
            {props.canEdit ? (
              <Tabs
                value={descTab}
                onChange={(v) => setDescTab(v as "view" | "edit")}
                items={[
                  { id: "view", label: "Перегляд" },
                  { id: "edit", label: "Редагувати" },
                ]}
              />
            ) : null}
          </div>
          {descTab === "edit" && props.canEdit ? (
            <div className="space-y-2">
              {dirty ? (
                <p className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  Незбережені зміни в описі
                </p>
              ) : null}
              <Textarea value={desc} rows={8} onChange={(e) => setDesc(e.target.value)} />
              <Button type="button" size="sm" onClick={saveDescription} disabled={pending}>
                Зберегти опис
              </Button>
            </div>
          ) : (
            <Markdown content={desc} />
          )}
        </div>

        {subtasks.length ? (
          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <h3 className="mb-2 font-semibold">Підзадачі</h3>
            <div className="space-y-1">
              {subtasks.map((s) => (
                <Link
                  key={s.id}
                  href={`/projects/${issue.project_id}/issues/${s.id}`}
                  className="flex justify-between text-sm hover:underline"
                >
                  <span>
                    <span className="font-medium text-sky-600">{s.key}</span> {s.title}
                  </span>
                  <span className="text-zinc-500">{s.status_name}</span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h3 className="font-semibold">Коментарі</h3>
          <CommentsPanel
            comments={comments}
            currentUserId={props.currentUserId || ""}
            isAdmin={!!props.isAdmin}
            onChange={setComments}
          />
          {props.canComment ? (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                const body = commentDraft.trim();
                if (!body) return;
                const fd = new FormData();
                fd.set("issueId", issue.id);
                fd.set("body", body);
                startTransition(async () => {
                  const res = await addCommentAction(fd);
                  if (res && "comment" in res && res.comment) {
                    setComments((prev) => [...prev, res.comment]);
                    setCommentDraft("");
                  }
                });
              }}
            >
              <Label>Новий коментар (можна @згадку)</Label>
              <MentionTextarea
                value={commentDraft}
                onChange={setCommentDraft}
                users={props.users}
                placeholder="Напишіть коментар, @логін для згадки"
              />
              <Button type="submit" size="sm" disabled={pending}>
                Додати коментар
              </Button>
            </form>
          ) : null}
        </div>

        {props.activity?.length ? (
          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <button
              type="button"
              className="text-sm font-semibold"
              onClick={() => setActivityOpen((v) => !v)}
            >
              Історія {activityOpen ? "▾" : "▸"}
            </button>
            {activityOpen ? (
              <div className="mt-2 space-y-1">
                {props.activity.map((a) => (
                  <p key={a.id} className="text-xs text-zinc-500">
                    {formatActivity(a.action, a.name, a.payload_json, issue.key)}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>Тип</Label>
              <Select
                defaultValue={issue.type}
                disabled={!props.canEdit}
                onChange={(e) => patch({ type: e.target.value })}
              >
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
                defaultValue={issue.priority}
                disabled={!props.canEdit}
                onChange={(e) => patch({ priority: e.target.value })}
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
                defaultValue={issue.status_id}
                disabled={!props.canEdit}
                onChange={(e) => patch({ statusId: e.target.value })}
              >
                {props.statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Виконавці</Label>
              <AssigneePicker
                users={props.users}
                value={assigneeIds}
                disabled={!props.canEdit}
                onChange={(ids) => {
                  setAssigneeIds(ids);
                  patch({ assigneeIds: ids });
                }}
              />
            </div>
            <div className="space-y-1">
              <Label>Початок</Label>
              <Input
                type="date"
                defaultValue={issue.start_date || ""}
                disabled={!props.canEdit}
                onBlur={(e) => patch({ start_date: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Дедлайн</Label>
              <Input
                type="date"
                defaultValue={issue.due_date || ""}
                disabled={!props.canEdit}
                onBlur={(e) => patch({ due_date: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Спринт</Label>
              <Select
                defaultValue={issue.sprint_id || ""}
                disabled={!props.canEdit}
                onChange={(e) => patch({ sprintId: e.target.value })}
              >
                <option value="">Беклог</option>
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
                defaultValue={issue.epic_id || ""}
                disabled={!props.canEdit}
                onChange={(e) => patch({ epicId: e.target.value })}
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
                type="number"
                defaultValue={issue.story_points ?? ""}
                disabled={!props.canEdit}
                onBlur={(e) => patch({ story_points: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Оцінка</Label>
              <Input
                placeholder="1г 30хв"
                defaultValue={
                  issue.original_estimate_sec != null
                    ? formatDuration(issue.original_estimate_sec)
                    : ""
                }
                disabled={!props.canEdit}
                onBlur={(e) => patch({ original_estimate: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Залишок</Label>
              <Input
                placeholder="45хв"
                defaultValue={
                  issue.remaining_estimate_sec != null
                    ? formatDuration(issue.remaining_estimate_sec)
                    : ""
                }
                disabled={!props.canEdit}
                onBlur={(e) => patch({ remaining_estimate: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Мітки</Label>
              <LabelPicker
                value={labels}
                suggestions={props.labelSuggestions}
                disabled={!props.canEdit}
                onChange={(next) => {
                  setLabels(next);
                  patch({ labels: next.join(", ") });
                }}
              />
            </div>
            {props.customFields.map((field) => (
              <div key={field.id} className="space-y-1">
                <Label>{field.name}</Label>
                {field.field_type === "select" ? (
                  <Select
                    defaultValue={field.value || ""}
                    disabled={!props.canEdit}
                    onChange={(e) => patch({ [`cf_${field.id}`]: e.target.value })}
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
                    type={
                      field.field_type === "number"
                        ? "number"
                        : field.field_type === "date"
                          ? "date"
                          : "text"
                    }
                    defaultValue={field.value || ""}
                    disabled={!props.canEdit}
                    onBlur={(e) => patch({ [`cf_${field.id}`]: e.target.value })}
                  />
                )}
              </div>
            ))}
          </div>
          {msg ? <p className="text-xs text-zinc-500">{msg}</p> : null}
        </div>

        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              startTransition(async () => {
                const res = await toggleWatcherAction(issue.id);
                if (res && "watching" in res) setWatching(!!res.watching);
                else setWatching((v) => !v);
              })
            }
          >
            {watching ? "Не стежити" : "Стежити"}
          </Button>
        </div>

        <div className="space-y-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h3 className="font-semibold">Звʼязки</h3>
          <LinksPanel
            projectId={issue.project_id}
            links={links}
            canManage={props.canEdit}
            onChange={setLinks}
          />
          {props.canEdit ? (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                fd.set("fromIssueId", issue.id);
                startTransition(async () => {
                  const res = await addIssueLinkAction(fd);
                  if (res && "link" in res && res.link) {
                    setLinks((prev) => [...prev, res.link]);
                    (e.target as HTMLFormElement).reset();
                  } else if (res && "error" in res) setMsg(res.error ?? "Помилка");
                });
              }}
            >
              <Select name="linkType" defaultValue="relates">
                <option value="blocks">блокує</option>
                <option value="is_blocked_by">заблокована</option>
                <option value="relates">повʼязана з</option>
                <option value="duplicates">дублює</option>
              </Select>
              <Input name="toKey" placeholder="DEMO-2" required />
              <Button type="submit" size="sm">
                Додати звʼязок
              </Button>
            </form>
          ) : null}
        </div>

        <div className="space-y-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h3 className="font-semibold">Облік часу</h3>
          <WorklogsPanel worklogs={worklogs} />
          {props.canEdit ? (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                fd.set("issueId", issue.id);
                startTransition(async () => {
                  const res = await addWorklogAction(fd);
                  if (res && "worklog" in res && res.worklog) {
                    setWorklogs((prev) => [res.worklog, ...prev]);
                    (e.target as HTMLFormElement).reset();
                  } else if (res && "error" in res) setMsg(res.error ?? "Помилка");
                });
              }}
            >
              <Input name="duration" placeholder="1г 30хв або 45хв" required />
              <Input name="work_date" type="date" />
              <Input name="note" placeholder="Нотатка" />
              <Button type="submit" size="sm">
                Залоговати
              </Button>
            </form>
          ) : null}
        </div>

        <div className="space-y-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h3 className="font-semibold">Вкладення (до 25 МБ)</h3>
          <AttachmentsPanel
            attachments={attachments}
            canManage={props.canEdit}
            onChange={setAttachments}
          />
          {props.canEdit ? (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const fd = new FormData(form);
                fd.set("issueId", issue.id);
                startTransition(async () => {
                  const res = await uploadAttachmentAction(fd);
                  if (res && "attachment" in res && res.attachment) {
                    setAttachments((prev) => [res.attachment, ...prev]);
                    form.reset();
                  } else if (res && "error" in res) setMsg(res.error ?? "Помилка");
                });
              }}
            >
              <Input name="file" type="file" required />
              <Button type="submit" size="sm">
                Завантажити
              </Button>
            </form>
          ) : null}
        </div>

        {props.canEdit && issue.type !== "subtask" ? (
          <form
            className="space-y-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const fd = new FormData(form);
              fd.set("parentId", issue.id);
              startTransition(async () => {
                const res = await createSubtaskAction(fd);
                if (res && "id" in res && res.id) {
                  setSubtasks((prev) => [
                    ...prev,
                    {
                      id: res.id,
                      key: res.key || "…",
                      title: res.title || String(fd.get("title") || ""),
                      status_name: res.status_name || "To Do",
                    },
                  ]);
                  form.reset();
                } else if (res && "error" in res) setMsg(res.error ?? "Помилка");
              });
            }}
          >
            <h3 className="font-semibold">Підзадача</h3>
            <Input name="title" placeholder="Назва підзадачі" required />
            <Button type="submit" size="sm">
              Створити
            </Button>
          </form>
        ) : null}

        {props.canEdit ? (
          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={pending}
            onClick={() => setConfirmDelete(true)}
          >
            Видалити задачу
          </Button>
        ) : null}
      </div>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Видалити ${issue.key}?`}
      >
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-300">
          Задачу буде видалено. Цю дію не можна скасувати з картки.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
            Скасувати
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() =>
              startTransition(async () => {
                const res = await deleteIssueAction(issue.id);
                if (res?.error) setMsg(res.error ?? "Помилка");
                else if (props.onDeleted) props.onDeleted();
                else if (res?.projectId) router.push(`/projects/${res.projectId}`);
              })
            }
          >
            Видалити
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
