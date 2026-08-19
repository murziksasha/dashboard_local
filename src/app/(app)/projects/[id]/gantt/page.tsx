import { GanttView } from "@/components/gantt/gantt-view";
import { ProjectNav } from "@/components/projects/project-nav";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { canEditIssues } from "@/lib/permissions";
import { loadProjectContext } from "@/lib/project-page";

export default async function GanttPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const ctx = loadProjectContext(user, id);

  const issues = all<{
    id: string;
    key: string;
    title: string;
    type: string;
    start_date: string | null;
    due_date: string | null;
    epic_id: string | null;
    parent_id: string | null;
  }>(
    `SELECT id, key, title, type, start_date, due_date, epic_id, parent_id
     FROM issues WHERE project_id = ? ORDER BY key`,
    [id],
  );

  const links = all<{
    from_issue_id: string;
    to_issue_id: string;
    link_type: string;
  }>(
    `SELECT l.from_issue_id, l.to_issue_id, l.link_type
     FROM issue_links l
     JOIN issues i ON i.id = l.from_issue_id
     WHERE i.project_id = ?`,
    [id],
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{ctx.project.name} — Gantt</h1>
        <p className="text-sm text-zinc-500">
          Timeline по датах і Dependencies Gantt по звʼязках blocks.
        </p>
      </div>
      <ProjectNav projectId={id} />
      <GanttView
        projectId={id}
        issues={issues}
        links={links}
        canEdit={canEditIssues(user, id)}
      />
    </div>
  );
}
