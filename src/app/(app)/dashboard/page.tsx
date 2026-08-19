import Link from "next/link";
import { WidgetControls } from "@/components/dashboard/widget-controls";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { ensurePersonalWidgets } from "@/lib/dashboard-widgets";
import { all } from "@/lib/db";
import { listProjectsForUser } from "@/lib/projects";
import { PRIORITY_LABELS } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default async function DashboardPage() {
  const user = await requireUser();
  const projects = listProjectsForUser(user);
  const widgets = ensurePersonalWidgets(user.id);

  const assigned = all<{
    id: string;
    key: string;
    title: string;
    priority: keyof typeof PRIORITY_LABELS;
    project_id: string;
    status_name: string;
    due_date: string | null;
  }>(
    `SELECT i.id, i.key, i.title, i.priority, i.project_id, i.due_date, s.name as status_name
     FROM issues i
     JOIN statuses s ON s.id = i.status_id
     JOIN issue_assignees ia ON ia.issue_id = i.id AND ia.user_id = ?
     WHERE s.category != 'done'
     ORDER BY i.updated_at DESC LIMIT 12`,
    [user.id],
  );

  const overdue = all<{
    id: string;
    key: string;
    title: string;
    project_id: string;
    due_date: string;
  }>(
    `SELECT i.id, i.key, i.title, i.project_id, i.due_date
     FROM issues i
     JOIN statuses s ON s.id = i.status_id
     JOIN issue_assignees ia ON ia.issue_id = i.id AND ia.user_id = ?
     WHERE i.due_date IS NOT NULL
       AND i.due_date < date('now') AND s.category != 'done'
     ORDER BY i.due_date ASC LIMIT 8`,
    [user.id],
  );

  const recent = all<{
    id: string;
    key: string;
    title: string;
    project_id: string;
    updated_at: string;
  }>(
    `SELECT i.id, i.key, i.title, i.project_id, i.updated_at
     FROM issues i
     JOIN project_members pm ON pm.project_id = i.project_id AND pm.user_id = ?
     ORDER BY i.updated_at DESC LIMIT 10`,
    [user.id],
  );

  const unread =
    all<{ c: number }>(
      `SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND read_at IS NULL`,
      [user.id],
    )[0]?.c ?? 0;

  const enabled = new Set(
    widgets.filter((w) => w.enabled).map((w) => w.widget_type),
  );
  const order = widgets.filter((w) => w.enabled).map((w) => w.widget_type);

  function renderWidget(type: string) {
    switch (type) {
      case "assigned":
        return (
          <Card key={type}>
            <CardHeader>
              <CardTitle>Призначено мені</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {assigned.length === 0 ? (
                <p className="text-sm text-zinc-500">Немає відкритих призначень.</p>
              ) : (
                assigned.map((issue) => (
                  <Link
                    key={issue.id}
                    href={`/projects/${issue.project_id}/issues/${issue.id}`}
                    className="flex items-start justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                  >
                    <div>
                      <p className="text-xs font-medium text-sky-600">{issue.key}</p>
                      <p className="text-sm font-medium">{issue.title}</p>
                      <p className="text-xs text-zinc-500">{issue.status_name}</p>
                    </div>
                    <Badge tone="amber">{PRIORITY_LABELS[issue.priority]}</Badge>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        );
      case "overdue":
        return (
          <Card key={type}>
            <CardHeader>
              <CardTitle>Прострочені</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {overdue.length === 0 ? (
                <p className="text-sm text-zinc-500">Все вчасно.</p>
              ) : (
                overdue.map((issue) => (
                  <Link
                    key={issue.id}
                    href={`/projects/${issue.project_id}/issues/${issue.id}`}
                    className="block rounded-lg border border-rose-200 px-3 py-2 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/40"
                  >
                    <p className="text-xs font-medium text-sky-600">{issue.key}</p>
                    <p className="text-sm font-medium">{issue.title}</p>
                    <p className="text-xs text-rose-600">до {formatDate(issue.due_date)}</p>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        );
      case "projects":
        return (
          <Card key={type}>
            <CardHeader>
              <CardTitle>Мої проєкти</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                >
                  <div>
                    <p className="text-sm font-semibold">{p.name}</p>
                    <p className="text-xs text-zinc-500">{p.key}</p>
                  </div>
                  <Badge tone="sky">Відкрити</Badge>
                </Link>
              ))}
            </CardContent>
          </Card>
        );
      case "recent":
        return (
          <Card key={type}>
            <CardHeader>
              <CardTitle>Нещодавно оновлені</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recent.map((issue) => (
                <Link
                  key={issue.id}
                  href={`/projects/${issue.project_id}/issues/${issue.id}`}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                >
                  <div>
                    <p className="text-xs text-sky-600">{issue.key}</p>
                    <p className="text-sm">{issue.title}</p>
                  </div>
                  <span className="text-xs text-zinc-400">
                    {formatDate(issue.updated_at, true)}
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>
        );
      case "notifications":
        return (
          <Card key={type}>
            <CardHeader>
              <CardTitle>Непрочитані сповіщення</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">{unread}</CardContent>
          </Card>
        );
      default:
        return null;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Особистий дашборд</h1>
        <p className="text-sm text-zinc-500">
          Огляд ваших задач, проєктів і непрочитаних сповіщень.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-500">
              Мої відкриті задачі
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{assigned.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-500">Прострочені</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-rose-600">{overdue.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-500">Проєкти</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{projects.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-500">
              Непрочитані сповіщення
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{unread}</CardContent>
        </Card>
      </div>

      <WidgetControls
        scope="personal"
        initial={widgets.map((w) => ({
          id: w.id,
          widget_type: w.widget_type,
          enabled: w.enabled,
          position: w.position,
        }))}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {order.map((type) => (enabled.has(type) ? renderWidget(type) : null))}
      </div>
    </div>
  );
}
