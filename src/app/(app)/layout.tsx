import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { NotificationsBell } from "@/components/layout/notifications-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getSessionUser, isSetupComplete } from "@/lib/auth";
import { maybeAutoBackup } from "@/lib/backup";
import { settingGet } from "@/lib/db";
import { runDueSoonNotifications } from "@/lib/due-soon";
import { initials } from "@/lib/utils";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSetupComplete()) redirect("/setup");
  const user = await getSessionUser();
  if (!user) redirect("/login");

  try {
    maybeAutoBackup();
  } catch {
    // non-fatal
  }
  try {
    runDueSoonNotifications(2);
  } catch {
    // non-fatal
  }

  const appName = settingGet("app_name") || "Dashboard Local";

  return (
    <div className="flex min-h-screen">
      <AppSidebar appName={appName} isAdmin={user.global_role === "admin"} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-zinc-200 bg-white/90 px-4 backdrop-blur md:px-6 dark:border-zinc-800 dark:bg-zinc-950/90">
          <div className="pl-10 md:pl-0">
            <p className="text-sm text-zinc-500">Вітаємо,</p>
            <p className="text-sm font-semibold leading-none">{user.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationsBell />
            <ThemeToggle />
            <Link
              href="/profile"
              className="flex size-8 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ background: "#0284c7" }}
              title="Профіль"
            >
              {initials(user.name)}
            </Link>
            <form action={logoutAction}>
              <Button type="submit" variant="outline" size="sm">
                Вийти
              </Button>
            </form>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
