import { CalendarView } from "@/components/projects/calendar-view";
import { IssueDrawerHost } from "@/components/issues/issue-drawer";
import { ProjectNav } from "@/components/projects/project-nav";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { listEpics } from "@/lib/issues";
import { listProjectLabels } from "@/lib/issue-workspace";
import { canComment } from "@/lib/permissions";
import { loadProjectPeople, loadProjectShell } from "@/lib/project-page";
import { listProjectSprints } from "@/lib/projects";

export default async function CalendarPage({
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

  const now = new Date();
  const ym = typeof sp.ym === "string" ? sp.ym : "";
  const match = /^(\d{4})-(\d{2})$/.exec(ym);
  const year = match ? Number(match[1]) : now.getFullYear();
  const month = match ? Number(match[2]) - 1 : now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const to = `${year}-${String(month + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
  const issues = all<{
    id: string;
    key: string;
    title: string;
    due_date: string;
  }>(
    `SELECT id, key, title, due_date FROM issues
     WHERE project_id = ? AND deleted_at IS NULL
       AND due_date IS NOT NULL AND due_date >= ? AND due_date <= ?
     ORDER BY due_date, key`,
    [id, from, to],
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{ctx.project.name} — календар</h1>
      <ProjectNav projectId={id} />
      <CalendarView
        projectId={id}
        year={year}
        month={month}
        issues={issues}
        canEdit={ctx.canEdit}
      />
      <IssueDrawerHost
        projectId={id}
        projectKey={ctx.project.key}
        statuses={ctx.statuses}
        users={users}
        sprints={listProjectSprints(id)}
        epics={listEpics(id)}
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
