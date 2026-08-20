import { redirect } from "next/navigation";
import { ProjectNav } from "@/components/projects/project-nav";
import { TrashList } from "@/components/projects/trash-list";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { canManageProject } from "@/lib/permissions";
import { loadProjectShell } from "@/lib/project-page";

export default async function TrashPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const ctx = loadProjectShell(user, id);
  if (!canManageProject(user, id)) redirect(`/projects/${id}`);
  const items = all<{
    id: string;
    key: string;
    title: string;
    deleted_at: string;
  }>(
    `SELECT id, key, title, deleted_at FROM issues
     WHERE project_id = ? AND deleted_at IS NOT NULL
     ORDER BY deleted_at DESC`,
    [id],
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{ctx.project.name} — кошик</h1>
      <p className="text-sm text-zinc-500">
        Задачі зберігаються 30 днів, потім видаляються остаточно разом із файлами.
      </p>
      <ProjectNav projectId={id} />
      {items.length === 0 ? (
        <EmptyState title="Кошик порожній" description="Видалені задачі зʼявляться тут." />
      ) : (
        <TrashList items={items} />
      )}
    </div>
  );
}
