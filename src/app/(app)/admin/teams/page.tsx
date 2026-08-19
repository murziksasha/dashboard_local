import { redirect } from "next/navigation";
import {
  addTeamMemberAction,
  createTeamAction,
  removeTeamMemberAction,
} from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";

export default async function AdminTeamsPage() {
  const user = await requireUser();
  if (user.global_role !== "admin") redirect("/dashboard");

  const users = all<{ id: string; name: string; login: string }>(
    `SELECT id, name, login FROM users WHERE active = 1 ORDER BY name`,
  );
  const teams = all<{ id: string; name: string; description: string | null }>(
    `SELECT id, name, description FROM teams ORDER BY name`,
  );
  const members = all<{ team_id: string; user_id: string; name: string }>(
    `SELECT tm.team_id, tm.user_id, u.name
     FROM team_members tm JOIN users u ON u.id = tm.user_id`,
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Керування командами</h1>

      <Card>
        <CardHeader>
          <CardTitle>Нова команда</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={async (fd) => {
              "use server";
              await createTeamAction(fd);
            }}
            className="space-y-3"
          >
            <div className="space-y-1">
              <Label>Назва</Label>
              <Input name="name" required />
            </div>
            <div className="space-y-1">
              <Label>Опис</Label>
              <Textarea name="description" rows={2} />
            </div>
            <div className="space-y-1">
              <Label>Учасники</Label>
              <div className="grid max-h-40 gap-1 overflow-auto rounded-md border border-zinc-200 p-2 dark:border-zinc-800">
                {users.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="members" value={u.id} />
                    {u.name} (@{u.login})
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit">Створити</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {teams.map((team) => {
          const teamMembers = members.filter((m) => m.team_id === team.id);
          return (
            <Card key={team.id}>
              <CardHeader>
                <CardTitle>{team.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-zinc-500">{team.description || "—"}</p>
                <div className="space-y-1">
                  {teamMembers.map((m) => (
                    <div key={m.user_id} className="flex items-center justify-between text-sm">
                      <span>{m.name}</span>
                      <form
                        action={async () => {
                          "use server";
                          await removeTeamMemberAction(team.id, m.user_id);
                        }}
                      >
                        <Button type="submit" size="sm" variant="ghost">
                          Прибрати
                        </Button>
                      </form>
                    </div>
                  ))}
                </div>
                <form
                  action={async (fd) => {
                    "use server";
                    const userId = String(fd.get("userId") || "");
                    await addTeamMemberAction(team.id, userId);
                  }}
                  className="flex gap-2"
                >
                  <select
                    name="userId"
                    className="h-9 flex-1 rounded-md border border-zinc-300 bg-transparent px-2 text-sm dark:border-zinc-700"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" size="sm">
                    Додати
                  </Button>
                </form>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
