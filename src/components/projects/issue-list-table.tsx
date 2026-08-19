"use client";

import Link from "next/link";
import { useState } from "react";
import { ListBulkBar, DeleteFilterButton } from "@/components/projects/list-bulk-bar";
import { SaveFilterForm } from "@/components/projects/save-filter-form";
import { Badge } from "@/components/ui/badge";
import { ISSUE_TYPE_LABELS, PRIORITY_LABELS, type IssueType, type Priority } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type Issue = {
  id: string;
  key: string;
  title: string;
  type: IssueType;
  priority: Priority;
  status_name?: string;
  assignee_name?: string | null;
  due_date: string | null;
};

export function IssueListTable({
  projectId,
  issues,
  statuses,
  users,
  canEdit,
  savedFilters,
  queryJson,
  currentUserId,
}: {
  projectId: string;
  issues: Issue[];
  statuses: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string }>;
  canEdit: boolean;
  savedFilters: Array<{ id: string; name: string; query_json: string; owner_id: string }>;
  queryJson: string;
  currentUserId: string;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.length === issues.length ? [] : issues.map((i) => i.id),
    );
  }

  return (
    <div className="space-y-3">
      {savedFilters.length ? (
        <div className="flex flex-wrap gap-2">
          {savedFilters.map((f) => {
            const parsed = JSON.parse(f.query_json || "{}") as Record<string, string>;
            const params = new URLSearchParams();
            for (const [k, v] of Object.entries(parsed)) {
              if (v) params.set(k, v);
            }
            return (
              <span
                key={f.id}
                className="inline-flex items-center rounded-full border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
              >
                <Link href={`/projects/${projectId}/list?${params.toString()}`}>
                  {f.name}
                </Link>
                {f.owner_id === currentUserId ? (
                  <DeleteFilterButton filterId={f.id} projectId={projectId} />
                ) : null}
              </span>
            );
          })}
        </div>
      ) : null}

      <SaveFilterForm projectId={projectId} queryJson={queryJson} />

      {canEdit ? (
        <ListBulkBar
          projectId={projectId}
          statuses={statuses}
          users={users}
          selectedIds={selected}
          onClear={() => setSelected([])}
        />
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
            <tr>
              {canEdit ? (
                <th className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.length === issues.length && issues.length > 0}
                    onChange={toggleAll}
                  />
                </th>
              ) : null}
              <th className="px-3 py-2">Ключ</th>
              <th className="px-3 py-2">Назва</th>
              <th className="px-3 py-2">Тип</th>
              <th className="px-3 py-2">Статус</th>
              <th className="px-3 py-2">Пріоритет</th>
              <th className="px-3 py-2">Виконавець</th>
              <th className="px-3 py-2">Дедлайн</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((issue) => (
              <tr key={issue.id} className="border-t border-zinc-200 dark:border-zinc-800">
                {canEdit ? (
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.includes(issue.id)}
                      onChange={() => toggle(issue.id)}
                    />
                  </td>
                ) : null}
                <td className="px-3 py-2">
                  <Link
                    className="font-medium text-sky-600"
                    href={`/projects/${projectId}/issues/${issue.id}`}
                  >
                    {issue.key}
                  </Link>
                </td>
                <td className="px-3 py-2">{issue.title}</td>
                <td className="px-3 py-2">{ISSUE_TYPE_LABELS[issue.type]}</td>
                <td className="px-3 py-2">{issue.status_name}</td>
                <td className="px-3 py-2">
                  <Badge>{PRIORITY_LABELS[issue.priority]}</Badge>
                </td>
                <td className="px-3 py-2">
                  {(issue as { assignee_names?: string | null }).assignee_names ||
                    issue.assignee_name ||
                    "—"}
                </td>
                <td className="px-3 py-2">{formatDate(issue.due_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
