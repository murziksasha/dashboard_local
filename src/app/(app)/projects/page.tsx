import Link from "next/link";
import { unarchiveProjectAction } from "@/app/actions/projects";
import { CreateProjectForm } from "@/components/projects/create-project-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { listProjectsForUser } from "@/lib/projects";
import { canManageProject } from "@/lib/permissions";

export default async function ProjectsPage() {
  const user = await requireUser();
  const projects = listProjectsForUser(user, { includeArchived: true });
  const active = projects.filter((p) => !p.archived);
  const archived = projects.filter((p) => p.archived);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Проєкти</h1>
          <p className="text-sm text-zinc-500">
            Оберіть проєкт або створіть новий (доступно адміністратору).
          </p>
        </div>
      </div>

      {user.global_role === "admin" ? <CreateProjectForm /> : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {active.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`}>
            <Card className="h-full transition hover:border-sky-400">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>{p.name}</CardTitle>
                  <Badge tone="sky">{p.key}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="line-clamp-3 text-sm text-zinc-500">
                  {p.description || "Без опису"}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
        {active.length === 0 ? (
          <p className="text-sm text-zinc-500">Поки немає доступних проєктів.</p>
        ) : null}
      </div>

      {archived.length ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Архів</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {archived.map((p) => (
              <Card key={p.id} className="opacity-80">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>{p.name}</CardTitle>
                    <Badge>Архів</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="line-clamp-2 text-sm text-zinc-500">
                    {p.description || "Без опису"}
                  </p>
                  {canManageProject(user, p.id) ? (
                    <form
                      action={async () => {
                        "use server";
                        await unarchiveProjectAction(p.id);
                      }}
                    >
                      <Button type="submit" size="sm" variant="secondary">
                        Відновити
                      </Button>
                    </form>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
