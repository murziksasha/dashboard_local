import { WidgetControls } from "@/components/dashboard/widget-controls";
import { ProjectNav } from "@/components/projects/project-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { ensureProjectWidgets } from "@/lib/dashboard-widgets";
import { all } from "@/lib/db";
import { loadProjectContext } from "@/lib/project-page";
import { formatDate } from "@/lib/utils";

export default async function ProjectDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const ctx = loadProjectContext(user, id);
  const widgets = ensureProjectWidgets(user.id, id);
  const enabled = new Set(widgets.filter((w) => w.enabled).map((w) => w.widget_type));

  const byStatus = all<{ name: string; c: number }>(
    `SELECT s.name, COUNT(i.id) as c
     FROM statuses s
     LEFT JOIN issues i ON i.status_id = s.id
     WHERE s.project_id = ?
     GROUP BY s.id
     ORDER BY s.position`,
    [id],
  );

  const createdVsDone = all<{ day: string; created: number; done: number }>(
    `SELECT date(created_at) as day,
            COUNT(*) as created,
            SUM(CASE WHEN s.category = 'done' THEN 1 ELSE 0 END) as done
     FROM issues i
     JOIN statuses s ON s.id = i.status_id
     WHERE i.project_id = ?
     GROUP BY date(created_at)
     ORDER BY day DESC
     LIMIT 14`,
    [id],
  );

  const activity = all<{
    action: string;
    created_at: string;
    name: string | null;
    issue_key: string | null;
  }>(
    `SELECT a.action, a.created_at, u.name, i.key as issue_key
     FROM activity_events a
     LEFT JOIN users u ON u.id = a.actor_id
     LEFT JOIN issues i ON i.id = a.issue_id
     WHERE a.project_id = ?
     ORDER BY a.created_at DESC LIMIT 20`,
    [id],
  );

  const activeSprint = ctx.sprints.find((s) => s.status === "active");
  const sprintIssues = activeSprint
    ? ctx.issues.filter((i) => i.sprint_id === activeSprint.id)
    : [];
  const sprintDone = sprintIssues.filter((i) => i.status_category === "done").length;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{ctx.project.name} — дашборд</h1>
      <ProjectNav projectId={id} />

      <WidgetControls
        scope="project"
        projectId={id}
        initial={widgets.map((w) => ({
          id: w.id,
          widget_type: w.widget_type,
          enabled: w.enabled,
          position: w.position,
        }))}
      />

      {enabled.has("totals") || enabled.has("sprint") ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {enabled.has("totals") ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-zinc-500">Усього задач</CardTitle>
                </CardHeader>
                <CardContent className="text-3xl font-bold">{ctx.issues.length}</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-zinc-500">Учасники</CardTitle>
                </CardHeader>
                <CardContent className="text-3xl font-bold">{ctx.members.length}</CardContent>
              </Card>
            </>
          ) : null}
          {enabled.has("sprint") ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-zinc-500">Активний спринт</CardTitle>
                </CardHeader>
                <CardContent>
                  {activeSprint ? (
                    <>
                      <p className="font-semibold">{activeSprint.name}</p>
                      <p className="text-sm text-zinc-500">
                        {sprintDone}/{sprintIssues.length} done
                      </p>
                    </>
                  ) : (
                    <p className="text-zinc-500">Немає</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-zinc-500">Прогрес спринту</CardTitle>
                </CardHeader>
                <CardContent className="text-3xl font-bold">
                  {sprintIssues.length
                    ? `${Math.round((sprintDone / sprintIssues.length) * 100)}%`
                    : "—"}
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {enabled.has("by_status") ? (
          <Card>
            <CardHeader>
              <CardTitle>По статусах</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {byStatus.map((row) => (
                <div key={row.name} className="flex items-center justify-between text-sm">
                  <span>{row.name}</span>
                  <span className="font-semibold">{row.c}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {enabled.has("created_done") ? (
          <Card>
            <CardHeader>
              <CardTitle>Створено / Done (14 днів)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {createdVsDone.length === 0 ? (
                <p className="text-sm text-zinc-500">Немає даних.</p>
              ) : (
                createdVsDone.map((row) => (
                  <div key={row.day} className="flex justify-between text-sm">
                    <span>{formatDate(row.day)}</span>
                    <span>
                      +{row.created} / done {row.done}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ) : null}

        {enabled.has("activity") ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Стрічка активності</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {activity.map((a, idx) => (
                <div key={idx} className="text-sm">
                  <span className="font-medium">{a.name || "Система"}</span>{" "}
                  <span className="text-zinc-500">{a.action}</span>{" "}
                  {a.issue_key ? (
                    <span className="text-sky-600">{a.issue_key}</span>
                  ) : null}
                  <span className="ml-2 text-xs text-zinc-400">
                    {formatDate(a.created_at, true)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
