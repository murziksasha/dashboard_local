import { ProjectNav } from "@/components/projects/project-nav";
import { requireUser } from "@/lib/auth";
import { loadProjectShell } from "@/lib/project-page";
import { formatDuration } from "@/lib/utils";
import { myWorklogByDay, worklogByDay, worklogByUser } from "@/lib/time-tracking";

export default async function TimePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const ctx = loadProjectShell(user, id);
  const byDay = worklogByDay(id, 14);
  const byUser = worklogByUser(id, 14);
  const mine = myWorklogByDay(user.id, 14);
  const max = Math.max(1, ...byDay.map((d) => d.seconds));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{ctx.project.name} — облік часу</h1>
      <ProjectNav projectId={id} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-3 font-semibold">Проєкт, 14 днів</h2>
          <div className="flex h-40 items-end gap-1">
            {byDay.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-sky-500"
                  style={{ height: `${Math.max(4, (d.seconds / max) * 100)}%` }}
                  title={`${d.day}: ${formatDuration(d.seconds)}`}
                />
                <span className="text-[9px] text-zinc-400">{d.day.slice(5)}</span>
              </div>
            ))}
            {!byDay.length ? <p className="text-sm text-zinc-500">Немає worklog.</p> : null}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-3 font-semibold">По людях</h2>
          <ul className="space-y-2 text-sm">
            {byUser.map((u) => (
              <li key={u.user_id} className="flex justify-between">
                <span>{u.name}</span>
                <span className="text-zinc-500">{formatDuration(u.seconds)}</span>
              </li>
            ))}
            {!byUser.length ? <li className="text-zinc-500">Порожньо</li> : null}
          </ul>
        </div>
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800 lg:col-span-2">
          <h2 className="mb-3 font-semibold">Мій час</h2>
          <p className="text-sm text-zinc-500">
            За 14 днів: {formatDuration(mine.reduce((s, d) => s + d.seconds, 0))}
          </p>
        </div>
      </div>
    </div>
  );
}
