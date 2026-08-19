import Link from "next/link";
import { KanbanBoard } from "@/components/board/kanban-board";
import { CreateIssueForm } from "@/components/issues/create-issue-form";
import { ProjectNav } from "@/components/projects/project-nav";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth";
import { loadProjectContext } from "@/lib/project-page";

export default async function SprintBoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const ctx = loadProjectContext(user, id);
  const activeSprint = ctx.sprints.find((s) => s.status === "active");

  if (!activeSprint) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{ctx.project.name} — Sprint board</h1>
        <ProjectNav projectId={id} />
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/30">
          Немає активного спринту. Створіть і запустіть спринт у{" "}
          <Link className="text-sky-600 underline" href={`/projects/${id}/backlog`}>
            Backlog
          </Link>
          .
        </p>
      </div>
    );
  }

  const sprintIssues = ctx.issues.filter(
    (i) => i.sprint_id === activeSprint.id && i.type !== "epic",
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">Sprint board</h1>
            <Badge tone="emerald">{activeSprint.name}</Badge>
          </div>
          {activeSprint.goal ? (
            <p className="mt-1 text-sm text-zinc-500">{activeSprint.goal}</p>
          ) : null}
          <p className="text-xs text-zinc-400">
            {activeSprint.start_date || "?"} → {activeSprint.end_date || "?"} ·{" "}
            {sprintIssues.length} задач
          </p>
        </div>
        {ctx.canEdit ? (
          <CreateIssueForm
            projectId={ctx.project.id}
            statuses={ctx.statuses}
            users={ctx.users}
            sprints={ctx.sprints.filter((s) => s.status !== "closed")}
            epics={ctx.epics.map((e) => ({ id: e.id, key: e.key, title: e.title }))}
            defaultSprintId={activeSprint.id}
          />
        ) : null}
      </div>
      <ProjectNav projectId={id} />
      <KanbanBoard
        projectId={ctx.project.id}
        initialStatuses={ctx.statuses}
        initialIssues={sprintIssues.map((i) => {
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
