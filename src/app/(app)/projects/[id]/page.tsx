import { Suspense } from "react";
import { KanbanBoard } from "@/components/board/kanban-board";
import { CreateIssueForm } from "@/components/issues/create-issue-form";
import { IssueDrawerHost } from "@/components/issues/issue-drawer";
import { BoardFilters } from "@/components/projects/board-filters";
import { ProjectNav } from "@/components/projects/project-nav";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth";
import { listBoardIssues, listEpics } from "@/lib/issues";
import { listProjectLabels } from "@/lib/issue-workspace";
import { canComment } from "@/lib/permissions";
import { loadProjectPeople, loadProjectShell } from "@/lib/project-page";
import { listProjectSprints } from "@/lib/projects";
import { PROJECT_ROLE_LABELS } from "@/lib/types";

export default async function ProjectBoardPage({
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
  const activeSprint = sprints.find((s) => s.status === "active");
  const scope =
    sp.scope === "all" ? "all" : sp.scope === "sprint" ? "sprint" : activeSprint ? "sprint" : "all";
  const useSprint = scope === "sprint" && !!activeSprint;
  const assigneeRaw = typeof sp.assignee === "string" ? sp.assignee : "";
  const assigneeId =
    assigneeRaw === "me" ? user.id : assigneeRaw || undefined;
  const due = sp.due === "overdue" ? "overdue" : undefined;
  const type = typeof sp.type === "string" && sp.type ? sp.type : undefined;
  const epicId = typeof sp.epic === "string" ? sp.epic : undefined;
  const label = typeof sp.label === "string" ? sp.label : undefined;

  const boardIssues = listBoardIssues(id, {
    sprintId: useSprint ? activeSprint!.id : undefined,
    includeEpics: !useSprint,
    excludeTypes: useSprint ? ["epic"] : undefined,
    assigneeId: assigneeId as "unassigned" | string | undefined,
    due,
    type: type as "bug" | "task" | "story" | "epic" | "subtask" | undefined,
    epicId,
    label,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{ctx.project.name}</h1>
            <Badge tone="sky">{ctx.project.key}</Badge>
            <Badge>{PROJECT_ROLE_LABELS[ctx.role]}</Badge>
          </div>
          {ctx.project.description ? (
            <p className="mt-1 text-sm text-zinc-500">{ctx.project.description}</p>
          ) : null}
          {activeSprint ? (
            <p className="mt-1 text-sm text-emerald-600">
              Активний спринт: {activeSprint.name}
              {activeSprint.goal ? ` — ${activeSprint.goal}` : ""}
            </p>
          ) : (
            <p className="mt-1 text-sm text-zinc-500">
              Немає активного спринту — показано всі задачі.
            </p>
          )}
        </div>
        {ctx.canEdit ? (
          <CreateIssueForm
            projectId={ctx.project.id}
            statuses={ctx.statuses}
            users={users}
            sprints={sprints.filter((s) => s.status !== "closed")}
            epics={epics}
            defaultSprintId={activeSprint?.id}
          />
        ) : null}
      </div>

      <p className="rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-600 md:hidden dark:bg-zinc-900 dark:text-zinc-300">
        На телефоні зручніше{" "}
        <a href={`/projects/${id}/list`} className="text-sky-600 underline">
          список
        </a>
        . Канбан — на широкому екрані.
      </p>
      <ProjectNav projectId={ctx.project.id} />
      <Suspense fallback={null}>
        <BoardFilters
          projectId={id}
          currentUserId={user.id}
          hasSprint={!!activeSprint}
        />
      </Suspense>

      <KanbanBoard
        projectId={ctx.project.id}
        initialStatuses={ctx.statuses}
        initialIssues={boardIssues.map((i) => {
          const epic = epics.find((e) => e.id === i.epic_id);
          return {
            id: i.id,
            key: i.key,
            title: i.title,
            type: i.type,
            priority: i.priority,
            status_id: i.status_id,
            assignee_id: i.assignee_id,
            assignee_name: i.assignee_name,
            assignee_names: i.assignee_names,
            epic_id: i.epic_id,
            epic_key: epic?.key ?? null,
            epic_title: epic?.title ?? null,
            labels: i.labels,
            story_points: i.story_points,
            due_date: i.due_date,
          };
        })}
        boardVersion={ctx.project.board_version}
        canEdit={ctx.canEdit}
        defaultSprintId={activeSprint?.id}
      />
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
