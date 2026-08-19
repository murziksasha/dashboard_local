import { CreateIssueForm } from "@/components/issues/create-issue-form";
import { BacklogClient } from "@/components/projects/backlog-client";
import { ProjectNav } from "@/components/projects/project-nav";
import { requireUser } from "@/lib/auth";
import { canManageProject } from "@/lib/permissions";
import { loadProjectContext } from "@/lib/project-page";

export default async function BacklogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const ctx = loadProjectContext(user, id);
  const backlog = ctx.issues.filter((i) => !i.sprint_id && i.type !== "subtask");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{ctx.project.name} — Backlog</h1>
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
      <BacklogClient
        projectId={ctx.project.id}
        backlog={backlog.map((i) => ({
          id: i.id,
          key: i.key,
          title: i.title,
          type: i.type,
          sprint_id: i.sprint_id,
          story_points: i.story_points,
        }))}
        sprints={ctx.sprints}
        canManage={canManageProject(user, ctx.project.id)}
        canEdit={ctx.canEdit}
      />
    </div>
  );
}
