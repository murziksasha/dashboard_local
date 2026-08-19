import { KanbanBoard } from "@/components/board/kanban-board";
import { CreateIssueForm } from "@/components/issues/create-issue-form";
import { ProjectNav } from "@/components/projects/project-nav";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth";
import { loadProjectContext } from "@/lib/project-page";
import { PROJECT_ROLE_LABELS } from "@/lib/types";

export default async function ProjectBoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const ctx = loadProjectContext(user, id);
  const activeSprint = ctx.sprints.find((s) => s.status === "active");

  const boardIssues = activeSprint
    ? ctx.issues.filter((i) => i.sprint_id === activeSprint.id || i.type === "epic")
    : ctx.issues;

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
            users={ctx.users}
            sprints={ctx.sprints.filter((s) => s.status !== "closed")}
            epics={ctx.epics.map((e) => ({
              id: e.id,
              key: e.key,
              title: e.title,
            }))}
            defaultSprintId={activeSprint?.id}
          />
        ) : null}
      </div>

      <ProjectNav projectId={ctx.project.id} />

      <KanbanBoard
        projectId={ctx.project.id}
        initialStatuses={ctx.statuses}
        initialIssues={boardIssues.map((i) => {
          const epic = ctx.epics.find((e) => e.id === i.epic_id);
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
          };
        })}
        boardVersion={ctx.project.board_version}
        canEdit={ctx.canEdit}
      />
    </div>
  );
}
