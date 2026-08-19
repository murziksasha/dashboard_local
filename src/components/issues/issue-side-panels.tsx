"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  deleteAttachmentAction,
  deleteCommentAction,
  deleteIssueLinkAction,
  updateCommentAction,
} from "@/app/actions/issues";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatDuration } from "@/lib/utils";

export function CommentsPanel({
  projectId,
  comments,
  currentUserId,
  isAdmin,
}: {
  projectId: string;
  comments: Array<{
    id: string;
    body: string;
    created_at: string;
    name: string;
    author_id: string;
  }>;
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      {comments.length === 0 ? (
        <p className="text-sm text-zinc-500">Поки немає коментарів.</p>
      ) : (
        comments.map((c) => (
          <div key={c.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <p className="text-xs text-zinc-500">
              {c.name} · {formatDate(c.created_at, true)}
            </p>
            {editing === c.id ? (
              <form
                className="mt-2 space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  fd.set("commentId", c.id);
                  startTransition(async () => {
                    await updateCommentAction(fd);
                    setEditing(null);
                    window.location.reload();
                  });
                }}
              >
                <Textarea name="body" defaultValue={c.body} rows={3} required />
                <div className="flex gap-2">
                  <Button type="submit" size="sm">
                    Зберегти
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                    Скасувати
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <div className="mt-1">
                  <Markdown content={c.body} />
                </div>
                {c.author_id === currentUserId || isAdmin ? (
                  <div className="mt-2 flex gap-2">
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(c.id)}>
                      Редагувати
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="danger"
                      onClick={() =>
                        startTransition(async () => {
                          await deleteCommentAction(c.id);
                          window.location.reload();
                        })
                      }
                    >
                      Видалити
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ))
      )}
      <span className="sr-only">{projectId}</span>
    </div>
  );
}

export function AttachmentsPanel({
  attachments,
  canManage,
}: {
  attachments: Array<{
    id: string;
    filename: string;
    size_bytes: number;
  }>;
  canManage: boolean;
}) {
  const [, startTransition] = useTransition();
  return (
    <div className="space-y-2">
      {attachments.map((a) => (
        <div key={a.id} className="flex items-center justify-between gap-2 text-sm">
          <a href={`/api/attachments/${a.id}`} className="text-sky-600 hover:underline">
            {a.filename} ({Math.round(a.size_bytes / 1024)} КБ)
          </a>
          {canManage ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() =>
                startTransition(async () => {
                  await deleteAttachmentAction(a.id);
                  window.location.reload();
                })
              }
            >
              Видалити
            </Button>
          ) : null}
        </div>
      ))}
      {attachments.length === 0 ? (
        <p className="text-sm text-zinc-500">Немає файлів.</p>
      ) : null}
    </div>
  );
}

export function LinksPanel({
  projectId,
  links,
  canManage,
}: {
  projectId: string;
  links: Array<{
    id: string;
    link_type: string;
    other_key: string;
    other_id: string;
    other_title: string;
  }>;
  canManage: boolean;
}) {
  const [, startTransition] = useTransition();
  return (
    <div className="space-y-2">
      {links.length === 0 ? (
        <p className="text-sm text-zinc-500">Немає звʼязків.</p>
      ) : (
        links.map((l) => (
          <div key={l.id + l.other_id} className="flex items-center justify-between gap-2 text-sm">
            <Link
              href={`/projects/${projectId}/issues/${l.other_id}`}
              className="text-sky-600 hover:underline"
            >
              {l.link_type}: {l.other_key} — {l.other_title}
            </Link>
            {canManage ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  startTransition(async () => {
                    await deleteIssueLinkAction(l.id);
                    window.location.reload();
                  })
                }
              >
                ✕
              </Button>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}

export function WorklogsPanel({
  worklogs,
}: {
  worklogs: Array<{
    id: string;
    seconds: number;
    work_date: string;
    note: string | null;
    name: string;
  }>;
}) {
  return (
    <div className="space-y-1">
      {worklogs.length === 0 ? (
        <p className="text-sm text-zinc-500">Немає записів.</p>
      ) : (
        worklogs.map((w) => (
          <div key={w.id} className="text-sm">
            {w.name}: {formatDuration(w.seconds)} ({formatDate(w.work_date)})
            {w.note ? ` — ${w.note}` : ""}
          </div>
        ))
      )}
    </div>
  );
}
