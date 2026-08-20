import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { listAuditEvents } from "@/lib/audit";
import { formatDate } from "@/lib/utils";

const ACTION_LABELS: Record<string, string> = {
  "login.ok": "Вхід",
  "login.fail": "Невдалий вхід",
  "login.lock": "Блокування логіну",
  "backup.create": "Бекап",
  "backup.restore": "Відновлення бекапу",
};

export default async function AuditPage() {
  const user = await requireUser();
  if (user.global_role !== "admin") redirect("/dashboard");
  const events = listAuditEvents(250);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Аудит входів</h1>
        <p className="text-sm text-zinc-500">
          Останні події логіну та бекапів. Зберігаються до 365 днів.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Події</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-zinc-500">Поки немає записів.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-zinc-500">
                  <tr>
                    <th className="px-2 py-1">Час</th>
                    <th className="px-2 py-1">Подія</th>
                    <th className="px-2 py-1">Логін</th>
                    <th className="px-2 py-1">IP</th>
                    <th className="px-2 py-1">Деталі</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id} className="border-t border-zinc-200 dark:border-zinc-800">
                      <td className="whitespace-nowrap px-2 py-1.5 text-xs text-zinc-500">
                        {formatDate(e.created_at, true)}
                      </td>
                      <td className="px-2 py-1.5">{ACTION_LABELS[e.action] || e.action}</td>
                      <td className="px-2 py-1.5">{e.login || "—"}</td>
                      <td className="px-2 py-1.5 font-mono text-xs">{e.ip || "—"}</td>
                      <td className="px-2 py-1.5 text-xs text-zinc-500">{e.detail || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
