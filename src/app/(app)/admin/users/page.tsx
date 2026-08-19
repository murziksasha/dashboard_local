import { redirect } from "next/navigation";
import {
  createUserAction,
  resetPasswordAction,
  toggleUserActiveAction,
} from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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
          <form
            action={async (fd) => {
              "use server";
              await createUserAction(fd);
            }}
            className="grid gap-3 md:grid-cols-2"
          >
            <div className="space-y-1">
              <Label>Логін</Label>
              <Input name="login" required />
            </div>
            <div className="space-y-1">
              <Label>Імʼя</Label>
              <Input name="name" required />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input name="email" type="email" />
            </div>
            <div className="space-y-1">
              <Label>Пароль</Label>
              <Input name="password" type="password" minLength={6} required />
            </div>
            <div className="space-y-1">
              <Label>Роль</Label>
              <Select name="global_role" defaultValue="user">
                <option value="user">Користувач</option>
                <option value="admin">Адмін</option>
              </Select>
            </div>
            <div className="flex items-end">
              <Button type="submit">Створити</Button>
            </div>
          </form>
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
                  <div className="flex flex-wrap gap-2">
                    <form
                      action={async () => {
                        "use server";
                        await toggleUserActiveAction(u.id, !u.active);
                      }}
                    >
                      <Button type="submit" size="sm" variant="secondary">
                        {u.active ? "Вимкнути" : "Увімкнути"}
                      </Button>
                    </form>
                    <form
                      action={async (fd) => {
                        "use server";
                        await resetPasswordAction(fd);
                      }}
                      className="flex gap-1"
                    >
                      <input type="hidden" name="userId" value={u.id} />
                      <Input
                        name="password"
                        type="password"
                        placeholder="Новий пароль"
                        className="h-8 w-36"
                        required
                        minLength={6}
                      />
                      <Button type="submit" size="sm" variant="outline">
                        Reset
                      </Button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
