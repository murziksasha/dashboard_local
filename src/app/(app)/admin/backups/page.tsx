import { redirect } from "next/navigation";
import { createBackupAction, restoreBackupAction } from "@/app/actions/backup";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { listBackups } from "@/lib/backup";
import { formatDate } from "@/lib/utils";

export default async function AdminBackupsPage() {
  const user = await requireUser();
  if (user.global_role !== "admin") redirect("/dashboard");
  const backups = listBackups();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Бекапи</h1>
          <p className="text-sm text-zinc-500">
            Автобекап створюється приблизно раз на добу під час роботи додатку. Копія містить
            SQLite і знімок папки вкладень.
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await createBackupAction();
          }}
        >
          <Button type="submit">Створити бекап зараз</Button>
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Наявні копії</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {backups.length === 0 ? (
            <p className="text-sm text-zinc-500">Бекапів ще немає.</p>
          ) : (
            backups.map((b) => (
              <div
                key={b.name}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800"
              >
                <div>
                  <p className="text-sm font-medium">{b.name}</p>
                  <p className="text-xs text-zinc-500">
                    {formatDate(b.mtime, true)} · {Math.round(b.size / 1024)} КБ
                    {b.uploadsSize
                      ? ` · файли ${Math.round(b.uploadsSize / 1024)} КБ`
                      : " · без знімка файлів"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <a href={`/api/backups/${encodeURIComponent(b.name)}`}>
                    <Button type="button" size="sm" variant="secondary">
                      Завантажити
                    </Button>
                  </a>
                  <form
                    action={async () => {
                      "use server";
                      await restoreBackupAction(b.name);
                    }}
                  >
                    <Button type="submit" size="sm" variant="danger">
                      Відновити
                    </Button>
                  </form>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
