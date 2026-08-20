import { Suspense } from "react";
import { CreateIssueForm } from "@/components/issues/create-issue-form";
import { IssueDrawerHost } from "@/components/issues/issue-drawer";
import { IssueListTable } from "@/components/projects/issue-list-table";
import { ProjectNav } from "@/components/projects/project-nav";
import { requireUser } from "@/lib/auth";
import { listProjectLabels } from "@/lib/issue-workspace";
import { canComment } from "@/lib/permissions";
import { ListFilters } from "@/components/projects/list-filters";
import { all } from "@/lib/db";
import { countIssues, listEpics, listIssues } from "@/lib/issues";
import { loadProjectPeople, loadProjectShell } from "@/lib/project-page";
import { listProjectSprints } from "@/lib/projects";
import { ISSUE_TYPE_LABELS, type IssueFilter, type IssueType } from "@/lib/types";

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
  const ctx = loadProjectShell(user, id);
  const { users } = loadProjectPeople(id);
  const sprints = listProjectSprints(id);
  const epics = listEpics(id);

  const q = typeof sp.q === "string" ? sp.q : "";
  const type = typeof sp.type === "string" ? sp.type : "";
  const statusId = typeof sp.status === "string" ? sp.status : "";
  const assignee = typeof sp.assignee === "string" ? sp.assignee : "";
  const sort = (typeof sp.sort === "string" ? sp.sort : "rank") as IssueFilter["sort"];
  const dir = sp.dir === "desc" ? "desc" : "asc";
  const page = Math.max(1, Number(sp.page || 1) || 1);
  const pageSize = 50;

  const filter: IssueFilter = {
    q: q || undefined,
    types: type && type in ISSUE_TYPE_LABELS ? [type as IssueType] : undefined,
    statusIds: statusId ? [statusId] : undefined,
    assigneeIds: assignee ? [assignee] : undefined,
    sort,
    dir,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  };
  const total = countIssues(id, filter);
  const issues = listIssues(id, filter);

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
            users={users}
            sprints={sprints.filter((s) => s.status !== "closed")}
            epics={epics}
          />
        ) : null}
      </div>
      <ProjectNav projectId={ctx.project.id} />

      <ListFilters
        projectId={id}
        q={q}
        type={type}
        statusId={statusId}
        assignee={assignee}
        sort={sort || "rank"}
        dir={dir}
        statuses={ctx.statuses}
        users={users}
        total={total}
        page={page}
        pageSize={pageSize}
      />

      <Suspense fallback={<p className="text-sm text-zinc-500">Список…</p>}>
        <IssueListTable
          projectId={id}
          issues={issues}
          statuses={ctx.statuses}
          users={users}
          canEdit={ctx.canEdit}
          savedFilters={savedFilters}
          queryJson={queryJson}
          currentUserId={user.id}
          sort={sort || "rank"}
          dir={dir}
        />
      </Suspense>
      <IssueDrawerHost
        projectId={id}
        projectKey={ctx.project.key}
        statuses={ctx.statuses}
        users={users}
        sprints={sprints}
        epics={epics}
        labelSuggestions={listProjectLabels(id)}
        canEdit={ctx.canEdit}
        canComment={canComment(user, id)}
        currentUserId={user.id}
        currentUserName={user.name}
        isAdmin={user.global_role === "admin"}
      />
    </div>
  );
}
