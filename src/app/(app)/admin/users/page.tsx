import { redirect } from "next/navigation";
import { CreateUserForm } from "@/components/admin/create-user-form";
import { UserRowActions } from "@/components/admin/user-row-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export default async function AdminUsersPage() {
  const user = await requireUser();
  if (user.global_role !== "admin") redirect("/dashboard");

  const users = all<{
    id: string;
    login: string;
    name: string;
    email: string | null;
    global_role: string;
    active: number;
    created_at: string;
  }>(`SELECT id, login, name, email, global_role, active, created_at FROM users ORDER BY name`);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Користувачі</h1>

      <Card>
        <CardHeader>
          <CardTitle>Створити користувача</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateUserForm />
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">Імʼя</th>
              <th className="px-3 py-2">Логін</th>
              <th className="px-3 py-2">Роль</th>
              <th className="px-3 py-2">Статус</th>
              <th className="px-3 py-2">Створено</th>
              <th className="px-3 py-2">Дії</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-3 py-2">{u.name}</td>
                <td className="px-3 py-2">{u.login}</td>
                <td className="px-3 py-2">{u.global_role}</td>
                <td className="px-3 py-2">{u.active ? "Активний" : "Вимкнений"}</td>
                <td className="px-3 py-2">{formatDate(u.created_at)}</td>
                <td className="px-3 py-2">
                  <UserRowActions userId={u.id} active={!!u.active} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
