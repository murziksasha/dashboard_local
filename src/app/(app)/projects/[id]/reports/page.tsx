import { BurndownChart } from "@/components/projects/burndown-chart";
import { ProjectNav } from "@/components/projects/project-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { loadProjectShell } from "@/lib/project-page";
import { listProjectSprints } from "@/lib/projects";
import { getBurndown, getTimeReport, getVelocity } from "@/lib/reports";
import { formatDate, formatDuration } from "@/lib/utils";

function monthRange() {
  const now = new Date();
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { from, to };
}

export default async function ReportsPage({
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
  const sprints = listProjectSprints(id);
  const active = sprints.find((s) => s.status === "active") || sprints[0];
  const sprintId = typeof sp.sprint === "string" && sp.sprint ? sp.sprint : active?.id;
  const defaults = monthRange();
  const from = typeof sp.from === "string" && sp.from ? sp.from : defaults.from;
  const to = typeof sp.to === "string" && sp.to ? sp.to : defaults.to;
  const burndown = sprintId ? getBurndown(sprintId) : { sprint: null, points: [], committed_points: 0 };
  const velocity = getVelocity(id);
  const time = getTimeReport(id, from, to);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{ctx.project.name} — звіти</h1>
      <ProjectNav projectId={id} />

      <Card>
        <CardHeader>
          <CardTitle>Burndown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sprints.length ? (
            <form className="flex flex-wrap items-end gap-2">
              <select
                name="sprint"
                defaultValue={sprintId || ""}
                className="h-9 rounded-md border border-zinc-300 bg-transparent px-2 text-sm dark:border-zinc-700"
              >
                {sprints.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.status})
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="h-9 rounded-md bg-sky-600 px-3 text-sm text-white"
              >
                Показати
              </button>
            </form>
          ) : (
            <p className="text-sm text-zinc-500">Немає спринтів.</p>
          )}
          {burndown.sprint ? (
            <p className="text-sm text-zinc-500">
              {burndown.sprint.name}
              {burndown.sprint.start_date ? ` · ${formatDate(burndown.sprint.start_date)}` : ""}
              {burndown.sprint.end_date ? ` – ${formatDate(burndown.sprint.end_date)}` : ""}
              {" · "}
              committed {burndown.committed_points} SP
            </p>
          ) : null}
          <BurndownChart points={burndown.points} committed={burndown.committed_points} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Velocity (закриті спринти)</CardTitle>
        </CardHeader>
        <CardContent>
          {velocity.length === 0 ? (
            <p className="text-sm text-zinc-500">Закритих спринтів ще немає.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-zinc-500">
                <tr>
                  <th className="py-1">Спринт</th>
                  <th className="py-1">Committed SP</th>
                  <th className="py-1">Done SP</th>
                </tr>
              </thead>
              <tbody>
                {velocity.map((v) => (
                  <tr key={v.sprint_id} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="py-1.5">{v.name}</td>
                    <td>{v.committed_points}</td>
                    <td>{v.completed_points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Облік часу</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form className="flex flex-wrap items-end gap-2">
            {sprintId ? <input type="hidden" name="sprint" value={sprintId} /> : null}
            <label className="text-xs text-zinc-500">
              Від
              <input
                type="date"
                name="from"
                defaultValue={from}
                className="mt-1 block h-9 rounded-md border border-zinc-300 bg-transparent px-2 text-sm dark:border-zinc-700"
              />
            </label>
            <label className="text-xs text-zinc-500">
              До
              <input
                type="date"
                name="to"
                defaultValue={to}
                className="mt-1 block h-9 rounded-md border border-zinc-300 bg-transparent px-2 text-sm dark:border-zinc-700"
              />
            </label>
            <button type="submit" className="h-9 rounded-md bg-sky-600 px-3 text-sm text-white">
              Фільтр
            </button>
            <p className="text-sm text-zinc-500">
              Разом: {formatDuration(time.totalSeconds)}
            </p>
          </form>
          {time.byUser.length === 0 ? (
            <p className="text-sm text-zinc-500">Немає work log за період.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-zinc-500">
                <tr>
                  <th className="py-1">Людина</th>
                  <th className="py-1">Час</th>
                  <th className="py-1">Записів</th>
                </tr>
              </thead>
              <tbody>
                {time.byUser.map((row) => (
                  <tr key={row.user_id} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="py-1.5">{row.name}</td>
                    <td>{formatDuration(row.seconds)}</td>
                    <td>{row.entries}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {time.entries.length ? (
            <div className="space-y-1 pt-2">
              <p className="text-xs font-medium text-zinc-500">Останні записи</p>
              {time.entries.map((e) => (
                <div key={e.id} className="flex flex-wrap justify-between gap-2 text-sm">
                  <span>
                    <span className="font-medium text-sky-600">{e.key}</span> {e.name}
                    {e.note ? ` — ${e.note}` : ""}
                  </span>
                  <span className="text-zinc-500">
                    {formatDate(e.work_date)} · {formatDuration(e.seconds)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
