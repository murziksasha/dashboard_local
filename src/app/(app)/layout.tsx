import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { CommandPalette } from "@/components/layout/command-palette";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { NotificationsBell } from "@/components/layout/notifications-bell";
import { DensityHydrate, UserMenu } from "@/components/layout/user-menu";
import { OnboardingTour } from "@/components/onboarding-tour";
import { getSessionUser, isSetupComplete } from "@/lib/auth";
import { settingGet } from "@/lib/db";
import { isLocale, LOCALE_COOKIE, t } from "@/lib/i18n";
import { ensureBackgroundJobs } from "@/lib/jobs";
import { listProjectsForUser } from "@/lib/projects";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSetupComplete()) redirect("/setup");
  const user = await getSessionUser();
  if (!user) redirect("/login");

  ensureBackgroundJobs();

  const appName = settingGet("app_name") || "Dashboard Local";
  const localeRaw = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(localeRaw) ? localeRaw : "uk";
  const projects = listProjectsForUser(user).map((p) => ({
    id: p.id,
    key: p.key,
    name: p.name,
  }));

  return (
    <div className="flex min-h-screen">
      <DensityHydrate />
      <AppSidebar
        appName={appName}
        isAdmin={user.global_role === "admin"}
        projects={projects}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-zinc-200 bg-white/90 px-4 backdrop-blur md:px-6 dark:border-zinc-800 dark:bg-zinc-950/90">
          <div className="pl-10 md:pl-0">
            <p className="text-sm text-zinc-500">{t(locale, "welcome")}</p>
            <p className="text-sm font-semibold leading-none">{user.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <CommandPalette />
            <LocaleSwitcher value={locale} />
            <NotificationsBell />
            <UserMenu name={user.name} />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
        <OnboardingTour />
      </div>
    </div>
  );
}
