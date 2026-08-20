import Link from "next/link";
import { ProjectNav } from "@/components/projects/project-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { JQL_HELP, runJql } from "@/lib/jql";
import { loadProjectShell } from "@/lib/project-page";
import { ISSUE_TYPE_LABELS, PRIORITY_LABELS } from "@/lib/types";

export default async function JqlPage({
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
  const q = typeof sp.q === "string" ? sp.q : "status != Done ORDER BY updated DESC";
  const result = runJql(id, q, user.id);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{ctx.project.name} — JQL</h1>
      <ProjectNav projectId={id} />

      <div className="flex flex-wrap gap-2">
        {[
          "assignee = currentUser() AND status != Done",
          "assignee is empty",
          "status CHANGED AFTER -7d",
          "status WAS Done",
          "cf[Risk] = high",
          "type = bug AND priority in (high, highest)",
          "due <= 7d AND category != done",
        ].map((sample) => (
          <a
            key={sample}
            href={`/projects/${id}/jql?q=${encodeURIComponent(sample)}`}
            className="rounded-full border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            {sample}
          </a>
        ))}
      </div>

      <form className="space-y-2 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <label className="text-sm font-medium">Запит</label>
        <textarea
          name="q"
          defaultValue={q}
          rows={3}
          className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 font-mono text-sm dark:border-zinc-700"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit">Виконати</Button>
          <details className="text-sm text-zinc-500">
            <summary className="cursor-pointer">Довідка</summary>
            <pre className="mt-2 whitespace-pre-wrap text-xs">{JQL_HELP}</pre>
          </details>
        </div>
        {result.error ? (
          <p className="text-sm text-rose-600">{result.error}</p>
        ) : (
          <p className="text-sm text-zinc-500">Знайдено: {result.issues.length}</p>
        )}
      </form>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">Ключ</th>
              <th className="px-3 py-2">Назва</th>
              <th className="px-3 py-2">Тип</th>
              <th className="px-3 py-2">Статус</th>
              <th className="px-3 py-2">Пріоритет</th>
              <th className="px-3 py-2">Виконавці</th>
            </tr>
          </thead>
          <tbody>
            {result.issues.map((issue) => (
              <tr key={issue.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-3 py-2">
                  <Link
                    className="font-medium text-sky-600"
                    href={`/projects/${id}/issues/${issue.id}`}
                  >
                    {issue.key}
                  </Link>
                </td>
                <td className="px-3 py-2">{issue.title}</td>
                <td className="px-3 py-2">{ISSUE_TYPE_LABELS[issue.type]}</td>
                <td className="px-3 py-2">{issue.status_name}</td>
                <td className="px-3 py-2">
                  <Badge>{PRIORITY_LABELS[issue.priority]}</Badge>
                </td>
                <td className="px-3 py-2">
                  {issue.assignee_names || issue.assignee_name || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
