import Link from "next/link";
import { notFound } from "next/navigation";
import { IssueDetailClient } from "@/components/issues/issue-detail-client";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth";
import { listEpics } from "@/lib/issues";
import { loadIssueWorkspace, listProjectLabels, safeFromPath } from "@/lib/issue-workspace";
import { loadProjectPeople, loadProjectShell } from "@/lib/project-page";
import { listProjectSprints } from "@/lib/projects";

export default async function IssuePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; issueId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id, issueId } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const ctx = loadProjectShell(user, id);
  const { users } = loadProjectPeople(id);
  const sprints = listProjectSprints(id);
  const epics = listEpics(id);
  const data = loadIssueWorkspace(user, id, issueId);
  if (!data) notFound();

  const from = safeFromPath(
    typeof sp.from === "string" ? sp.from : undefined,
    `/projects/${id}`,
  );

  return (
    <div className="space-y-4">
      <div>
        <nav className="flex flex-wrap items-center gap-1 text-sm text-zinc-500">
          <Link href="/projects" className="hover:text-sky-600">
            Проєкти
          </Link>
          <span>/</span>
          <Link href={`/projects/${id}`} className="hover:text-sky-600">
            {ctx.project.key}
          </Link>
          <span>/</span>
          <Link href={from} className="text-sky-600 hover:underline">
            Назад
          </Link>
          <span>/</span>
          <span className="text-zinc-800 dark:text-zinc-200">{data.issue.key}</span>
        </nav>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge tone="sky">{data.issue.key}</Badge>
        </div>
      </div>

      <IssueDetailClient
        issue={{
          id: data.issue.id,
          project_id: data.issue.project_id,
          key: data.issue.key,
          title: data.issue.title,
          description: data.issue.description,
          type: data.issue.type,
          priority: data.issue.priority,
          status_id: data.issue.status_id,
          assignee_id: data.issue.assignee_id,
          epic_id: data.issue.epic_id,
          sprint_id: data.issue.sprint_id,
          story_points: data.issue.story_points,
          original_estimate_sec: data.issue.original_estimate_sec,
          remaining_estimate_sec: data.issue.remaining_estimate_sec,
          start_date: data.issue.start_date ?? null,
          due_date: data.issue.due_date,
        }}
        labels={data.labels}
        labelSuggestions={listProjectLabels(id)}
        assigneeIds={data.assigneeIds}
        statuses={ctx.statuses}
        users={users}
        sprints={sprints}
        epics={epics}
        customFields={data.customFields}
        watching={data.watching}
        canEdit={data.canEdit}
        canComment={data.canComment}
        comments={data.comments}
        attachments={data.attachments}
        links={data.links}
        worklogs={data.worklogs}
        subtasks={data.subtasks}
        activity={data.activity}
        currentUserId={user.id}
        currentUserName={user.name}
        isAdmin={user.global_role === "admin"}
      />
    </div>
  );
}
