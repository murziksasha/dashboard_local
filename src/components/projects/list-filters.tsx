"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ISSUE_TYPE_LABELS } from "@/lib/types";

export function ListFilters({
  projectId,
  q,
  type,
  statusId,
  assignee,
  sort,
  dir,
  statuses,
  users,
  total,
  page,
  pageSize,
}: {
  projectId: string;
  q: string;
  type: string;
  statusId: string;
  assignee: string;
  sort: string;
  dir: string;
  statuses: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string }>;
  total: number;
  page: number;
  pageSize: number;
}) {
  const router = useRouter();
  const pages = Math.max(1, Math.ceil(total / pageSize));

  function go(patch: Record<string, string>, resetPage = true) {
    const sp = new URLSearchParams();
    const next = {
      q,
      type,
      status: statusId,
      assignee,
      sort,
      dir,
      page: String(page),
      ...patch,
    };
    if (resetPage && !patch.page) next.page = "1";
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
    }
    router.replace(`/projects/${projectId}/list?${sp.toString()}`);
  }

  return (
    <div className="space-y-2">
      <form
        className="grid gap-2 rounded-xl border border-zinc-200 bg-white p-3 md:grid-cols-5 dark:border-zinc-800 dark:bg-zinc-900"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          go({
            q: String(fd.get("q") || ""),
            type: String(fd.get("type") || ""),
            status: String(fd.get("status") || ""),
            assignee: String(fd.get("assignee") || ""),
          });
        }}
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="Пошук..."
          className="h-9 rounded-md border border-zinc-300 bg-transparent px-3 text-sm dark:border-zinc-700"
        />
        <select
          name="type"
          defaultValue={type}
          className="h-9 rounded-md border border-zinc-300 bg-transparent px-3 text-sm dark:border-zinc-700"
          onChange={(e) => go({ type: e.target.value })}
        >
          <option value="">Усі типи</option>
          {Object.entries(ISSUE_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={statusId}
          className="h-9 rounded-md border border-zinc-300 bg-transparent px-3 text-sm dark:border-zinc-700"
          onChange={(e) => go({ status: e.target.value })}
        >
          <option value="">Усі статуси</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          name="assignee"
          defaultValue={assignee}
          className="h-9 rounded-md border border-zinc-300 bg-transparent px-3 text-sm dark:border-zinc-700"
          onChange={(e) => go({ assignee: e.target.value })}
        >
          <option value="">Усі виконавці</option>
          <option value="unassigned">Не призначено</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-9 rounded-md bg-sky-600 px-3 text-sm font-medium text-white"
        >
          Фільтрувати
        </button>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-500">
        <span>
          {total} задач · стор. {page}/{pages}
        </span>
        <div className="flex gap-2">
          {page > 1 ? (
            <button type="button" className="text-sky-600" onClick={() => go({ page: String(page - 1) }, false)}>
              Назад
            </button>
          ) : null}
          {page < pages ? (
            <button type="button" className="text-sky-600" onClick={() => go({ page: String(page + 1) }, false)}>
              Далі
            </button>
          ) : null}
          <Link href={`/projects/${projectId}/list`} className="text-zinc-400 hover:underline">
            Скинути
          </Link>
        </div>
      </div>
    </div>
  );
}
