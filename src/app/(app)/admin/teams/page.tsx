import { redirect } from "next/navigation";
import { CreateTeamForm } from "@/components/admin/create-team-form";
import { TeamMemberControls } from "@/components/admin/team-member-controls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const members = all<{ team_id: string; user_id: string; name: string; login: string }>(
    `SELECT tm.team_id, tm.user_id, u.name, u.login
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
          <CreateTeamForm users={users} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {teams.map((team) => {
          const teamMembers = members
            .filter((m) => m.team_id === team.id)
            .map((m) => ({ id: m.user_id, name: m.name, login: m.login }));
          const memberSet = new Set(teamMembers.map((m) => m.id));
          const candidates = users.filter((u) => !memberSet.has(u.id));
          return (
            <Card key={team.id}>
              <CardHeader>
                <CardTitle>{team.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-zinc-500">{team.description || "—"}</p>
                <TeamMemberControls
                  teamId={team.id}
                  members={teamMembers}
                  candidates={candidates}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
