import { Suspense } from "react";
import { CreateIssueForm } from "@/components/issues/create-issue-form";
import { IssueDrawerHost } from "@/components/issues/issue-drawer";
import { BacklogClient } from "@/components/projects/backlog-client";
import { ProjectNav } from "@/components/projects/project-nav";
import { requireUser } from "@/lib/auth";
import { listEpics, listIssues } from "@/lib/issues";
import { listProjectLabels } from "@/lib/issue-workspace";
import { canComment, canManageProject } from "@/lib/permissions";
import { loadProjectPeople, loadProjectShell } from "@/lib/project-page";
import { listProjectSprints } from "@/lib/projects";

export default async function BacklogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const ctx = loadProjectShell(user, id);
  const { users } = loadProjectPeople(id);
  const sprints = listProjectSprints(id);
  const epics = listEpics(id);
  const activeSprint = sprints.find((s) => s.status === "active");
  const backlog = listIssues(id, { sprintId: "backlog", excludeTypes: ["subtask"] });
  const sprintIssues = activeSprint
    ? listIssues(id, { sprintId: activeSprint.id, excludeTypes: ["subtask"] })
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{ctx.project.name} — беклог</h1>
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
      <Suspense fallback={<p className="text-sm text-zinc-500">Беклог…</p>}>
        <BacklogClient
          projectId={ctx.project.id}
          backlog={backlog.map((i) => ({
            id: i.id,
            key: i.key,
            title: i.title,
            type: i.type,
            sprint_id: i.sprint_id,
            story_points: i.story_points,
            priority: i.priority,
            due_date: i.due_date,
            assignee_name: i.assignee_name,
          }))}
          sprintIssues={sprintIssues.map((i) => ({
            id: i.id,
            key: i.key,
            title: i.title,
            type: i.type,
            sprint_id: i.sprint_id,
            story_points: i.story_points,
            priority: i.priority,
            due_date: i.due_date,
            assignee_name: i.assignee_name,
          }))}
          sprints={sprints}
          canManage={canManageProject(user, ctx.project.id)}
          canEdit={ctx.canEdit}
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
