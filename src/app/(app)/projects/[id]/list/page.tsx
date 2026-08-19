import { CreateIssueForm } from "@/components/issues/create-issue-form";
import { IssueListTable } from "@/components/projects/issue-list-table";
import { ProjectNav } from "@/components/projects/project-nav";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { loadProjectContext } from "@/lib/project-page";
import { ISSUE_TYPE_LABELS } from "@/lib/types";

export default async function ProjectListPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const ctx = loadProjectContext(user, id);

  const q = typeof sp.q === "string" ? sp.q : "";
  const type = typeof sp.type === "string" ? sp.type : "";
  const statusId = typeof sp.status === "string" ? sp.status : "";
  const assignee = typeof sp.assignee === "string" ? sp.assignee : "";

  let issues = ctx.issues;
  if (q) {
    const qq = q.toLowerCase();
    issues = issues.filter(
      (i) =>
        i.title.toLowerCase().includes(qq) ||
        i.key.toLowerCase().includes(qq) ||
        (i.description || "").toLowerCase().includes(qq),
    );
  }
  if (type) issues = issues.filter((i) => i.type === type);
  if (statusId) issues = issues.filter((i) => i.status_id === statusId);
  if (assignee === "unassigned") issues = issues.filter((i) => !i.assignee_id);
  else if (assignee) issues = issues.filter((i) => i.assignee_id === assignee);

  const savedFilters = all<{
    id: string;
    name: string;
    query_json: string;
    owner_id: string;
  }>(
    `SELECT id, name, query_json, owner_id FROM saved_filters
     WHERE project_id = ? AND (owner_id = ? OR shared = 1)
     ORDER BY name`,
    [id, user.id],
  );

  const queryJson = JSON.stringify({ q, type, status: statusId, assignee });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{ctx.project.name} — список</h1>
        {ctx.canEdit ? (
          <CreateIssueForm
            projectId={ctx.project.id}
            statuses={ctx.statuses}
            users={ctx.users}
            sprints={ctx.sprints.filter((s) => s.status !== "closed")}
            epics={ctx.epics.map((e) => ({ id: e.id, key: e.key, title: e.title }))}
          />
        ) : null}
      </div>
      <ProjectNav projectId={ctx.project.id} />

      <form className="grid gap-2 rounded-xl border border-zinc-200 bg-white p-3 md:grid-cols-5 dark:border-zinc-800 dark:bg-zinc-900">
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
        >
          <option value="">Усі статуси</option>
          {ctx.statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          name="assignee"
          defaultValue={assignee}
          className="h-9 rounded-md border border-zinc-300 bg-transparent px-3 text-sm dark:border-zinc-700"
        >
          <option value="">Усі виконавці</option>
          <option value="unassigned">Не призначено</option>
          {ctx.users.map((u) => (
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

      <IssueListTable
        projectId={id}
        issues={issues}
        statuses={ctx.statuses}
        users={ctx.users}
        canEdit={ctx.canEdit}
        savedFilters={savedFilters}
        queryJson={queryJson}
        currentUserId={user.id}
      />
    </div>
  );
}
