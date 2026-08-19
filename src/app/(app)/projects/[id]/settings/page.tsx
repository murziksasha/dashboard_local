import { redirect } from "next/navigation";
import {
  addProjectMemberAction,
  addProjectTeamAction,
  archiveProjectAction,
  createCustomFieldAction,
  removeProjectMemberAction,
  removeProjectTeamAction,
} from "@/app/actions/projects";
import {
  createWorkflowRuleAction,
  deleteWorkflowRuleAction,
} from "@/app/actions/workflow";
import { ProjectNav } from "@/components/projects/project-nav";
import { StatusManager } from "@/components/projects/status-manager";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { canManageProject } from "@/lib/permissions";
import { loadProjectContext } from "@/lib/project-page";
import { PROJECT_ROLE_LABELS } from "@/lib/types";
import { listWorkflowRules } from "@/lib/workflow";

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const ctx = loadProjectContext(user, id);
  if (!canManageProject(user, id) && user.global_role !== "admin") {
    redirect(`/projects/${id}`);
  }

  const teams = all<{ id: string; name: string }>(
    `SELECT id, name FROM teams ORDER BY name`,
  );
  const projectTeams = all<{ team_id: string; name: string; role: string }>(
    `SELECT pt.team_id, t.name, pt.role
     FROM project_teams pt JOIN teams t ON t.id = pt.team_id
     WHERE pt.project_id = ?`,
    [id],
  );
  const customFields = all<{
    id: string;
    name: string;
    field_type: string;
  }>(
    `SELECT id, name, field_type FROM custom_field_defs WHERE project_id = ? ORDER BY position`,
    [id],
  );
  const workflowRules = listWorkflowRules(id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{ctx.project.name} — налаштування</h1>
        <form
          action={async () => {
            "use server";
            await archiveProjectAction(id);
            redirect("/projects");
          }}
        >
          <Button type="submit" variant="danger" size="sm">
            Архівувати проєкт
          </Button>
        </form>
      </div>
      <ProjectNav projectId={id} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Учасники</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {ctx.members.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {m.name}{" "}
                  <span className="text-zinc-500">
                    ({PROJECT_ROLE_LABELS[m.role as keyof typeof PROJECT_ROLE_LABELS] || m.role})
                  </span>
                </span>
                <form
                  action={async () => {
                    "use server";
                    await removeProjectMemberAction(id, m.id);
                  }}
                >
                  <Button type="submit" size="sm" variant="ghost">
                    Прибрати
                  </Button>
                </form>
              </div>
            ))}
            <form
              action={addProjectMemberAction}
              className="space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-800"
            >
              <input type="hidden" name="projectId" value={id} />
              <Label>Додати користувача</Label>
              <Select name="userId" required>
                {ctx.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} (@{u.login})
                  </option>
                ))}
              </Select>
              <Select name="role" defaultValue="member">
                <option value="lead">Керівник</option>
                <option value="member">Учасник</option>
                <option value="viewer">Спостерігач</option>
              </Select>
              <Button type="submit" size="sm">
                Додати
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Команди проєкту</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {projectTeams.map((t) => (
              <div key={t.team_id} className="flex items-center justify-between text-sm">
                <span>
                  {t.name} —{" "}
                  {PROJECT_ROLE_LABELS[t.role as keyof typeof PROJECT_ROLE_LABELS] || t.role}
                </span>
                <form
                  action={async () => {
                    "use server";
                    await removeProjectTeamAction(id, t.team_id);
                  }}
                >
                  <Button type="submit" size="sm" variant="ghost">
                    Прибрати
                  </Button>
                </form>
              </div>
            ))}
            <form
              action={addProjectTeamAction}
              className="space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-800"
            >
              <input type="hidden" name="projectId" value={id} />
              <Select name="teamId" required>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
              <Select name="role" defaultValue="member">
                <option value="lead">Керівник</option>
                <option value="member">Учасник</option>
                <option value="viewer">Спостерігач</option>
              </Select>
              <Button type="submit" size="sm">
                Додати команду
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Статуси дошки (порядок, WIP, CRUD)</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusManager
              projectId={id}
              initial={ctx.statuses.map((s) => ({
                id: s.id,
                name: s.name,
                category: s.category,
                wip_limit: s.wip_limit,
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Custom fields</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {customFields.map((f) => (
              <div key={f.id} className="text-sm">
                {f.name} <span className="text-zinc-500">({f.field_type})</span>
              </div>
            ))}
            <form
              action={createCustomFieldAction}
              className="space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-800"
            >
              <input type="hidden" name="projectId" value={id} />
              <Input name="name" placeholder="Назва поля" required />
              <Select name="field_type" defaultValue="text">
                <option value="text">text</option>
                <option value="number">number</option>
                <option value="select">select</option>
                <option value="date">date</option>
                <option value="user">user</option>
              </Select>
              <Input name="options" placeholder="Опції для select через кому" />
              <Button type="submit" size="sm">
                Створити поле
              </Button>
            </form>
            <a
              className="inline-block text-sm text-sky-600 hover:underline"
              href={`/api/export/${id}`}
            >
              Експорт issues у CSV
            </a>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Workflow conditions / validators</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {workflowRules.length === 0 ? (
              <p className="text-sm text-zinc-500">Правил ще немає.</p>
            ) : (
              workflowRules.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
                >
                  <div>
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-zinc-500">
                      {r.from_status_id || "*"} → {r.to_status_id || "*"}
                      {r.require_assignee ? " · assignee" : ""}
                      {r.require_due_date ? " · due" : ""}
                      {r.block_if_open_blockers ? " · no open blockers" : ""}
                      {r.only_roles ? ` · roles: ${r.only_roles}` : ""}
                    </p>
                  </div>
                  <form
                    action={async () => {
                      "use server";
                      await deleteWorkflowRuleAction(id, r.id);
                    }}
                  >
                    <Button type="submit" size="sm" variant="ghost">
                      Видалити
                    </Button>
                  </form>
                </div>
              ))
            )}

            <form
              action={createWorkflowRuleAction}
              className="grid gap-2 border-t border-zinc-200 pt-3 md:grid-cols-2 dark:border-zinc-800"
            >
              <input type="hidden" name="projectId" value={id} />
              <Input name="name" placeholder="Назва правила" required className="md:col-span-2" />
              <Select name="fromStatusId" defaultValue="">
                <option value="">З будь-якого статусу</option>
                {ctx.statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <Select name="toStatusId" defaultValue="">
                <option value="">В будь-який статус</option>
                {ctx.statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="requireAssignee" className="size-4" />
                Потрібен assignee
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="requireDueDate" className="size-4" />
                Потрібен due date
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="blockIfOpenBlockers" className="size-4" />
                Блокувати якщо є open blockers
              </label>
              <div className="flex flex-wrap gap-3 text-sm">
                <label className="flex items-center gap-1">
                  <input type="checkbox" name="onlyRoles" value="lead" /> lead
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" name="onlyRoles" value="member" /> member
                </label>
              </div>
              <Button type="submit" size="sm" className="md:col-span-2 w-fit">
                Додати правило
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
