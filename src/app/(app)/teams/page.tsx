import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";

export default async function TeamsPage() {
  const user = await requireUser();
  const teams = all<{
    id: string;
    name: string;
    description: string | null;
    members: number;
  }>(
    `SELECT t.id, t.name, t.description, COUNT(tm.user_id) as members
     FROM teams t
     LEFT JOIN team_members tm ON tm.team_id = t.id
     GROUP BY t.id
     ORDER BY t.name`,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Команди</h1>
          <p className="text-sm text-zinc-500">
            Команди можна додавати до проєктів для спільного доступу.
          </p>
        </div>
        {user.global_role === "admin" ? (
          <Link href="/admin/teams" className="text-sm text-sky-600 hover:underline">
            Керувати командами →
          </Link>
        ) : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {teams.map((t) => (
          <Card key={t.id}>
            <CardHeader>
              <CardTitle>{t.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-500">{t.description || "Без опису"}</p>
              <p className="mt-2 text-sm font-medium">{t.members} учасників</p>
            </CardContent>
          </Card>
        ))}
        {teams.length === 0 ? (
          <EmptyState
            className="md:col-span-2 xl:col-span-3"
            title="Команд ще немає"
            description="Адміністратор може створити команди й додати учасників."
            action={
              user.global_role === "admin" ? (
                <Link
                  href="/admin/teams"
                  className="text-sm font-medium text-sky-600 hover:underline"
                >
                  Створити команду
                </Link>
              ) : null
            }
          />
        ) : null}
      </div>
    </div>
  );
}
