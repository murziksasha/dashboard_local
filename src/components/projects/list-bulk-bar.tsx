"use client";

import { useState, useTransition } from "react";
import { bulkUpdateIssuesAction } from "@/app/actions/issues";
import { deleteFilterAction } from "@/app/actions/filters";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

export function ListBulkBar({
  projectId,
  statuses,
  users,
  selectedIds,
  onClear,
}: {
  projectId: string;
  statuses: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string }>;
  selectedIds: string[];
  onClear: () => void;
}) {
  const [statusId, setStatusId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [pending, startTransition] = useTransition();
  if (!selectedIds.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 dark:border-sky-900 dark:bg-sky-950/30">
      <span className="text-sm font-medium">Обрано: {selectedIds.length}</span>
      <Select value={statusId} onChange={(e) => setStatusId(e.target.value)} className="w-40">
        <option value="">Статус…</option>
        {statuses.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
      <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="w-44">
        <option value="">Виконавець…</option>
        <option value="__unassigned">Не призначено</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </Select>
      <Button
        size="sm"
        disabled={pending || (!statusId && !assigneeId)}
        onClick={() =>
          startTransition(async () => {
            await bulkUpdateIssuesAction({
              issueIds: selectedIds,
              statusId: statusId || undefined,
              assigneeId: assigneeId
                ? assigneeId === "__unassigned"
                  ? null
                  : assigneeId
                : undefined,
            });
            onClear();
            window.location.reload();
          })
        }
      >
        Застосувати
      </Button>
      <Button size="sm" variant="ghost" onClick={onClear}>
        Скинути
      </Button>
      <span className="sr-only">{projectId}</span>
    </div>
  );
}

export function DeleteFilterButton({
  filterId,
  projectId,
}: {
  filterId: string;
  projectId: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className="ml-1 text-xs text-rose-600 hover:underline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await deleteFilterAction(filterId, projectId);
          window.location.reload();
        })
      }
    >
      ✕
    </button>
  );
}
