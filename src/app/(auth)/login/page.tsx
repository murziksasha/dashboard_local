import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionUser, isSetupComplete } from "@/lib/auth";
import { settingGet } from "@/lib/db";
import { isLdapEnabled } from "@/lib/ldap";
import { isOidcEnabled } from "@/lib/oidc";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isSetupComplete()) redirect("/setup");
  const user = await getSessionUser();
  if (user) redirect("/dashboard");
  const appName = settingGet("app_name") || "Dashboard Local";
  const sp = await searchParams;
  const errorCode = typeof sp.error === "string" ? sp.error : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 via-white to-violet-50 p-4 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{appName}</CardTitle>
          <CardDescription>
            Увійдіть, щоб працювати із задачами команди.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm
            oidcEnabled={isOidcEnabled()}
            ldapEnabled={isLdapEnabled()}
            errorCode={errorCode}
          />
        </CardContent>
      </Card>
    </div>
  );
}
