import { redirect } from "next/navigation";
import {
  sendTestNotificationAction,
  updateNotifySettingsAction,
  updateOidcSettingsAction,
} from "@/app/actions/integration-settings";
import { updateLdapSettingsAction } from "@/app/actions/ldap-settings";
import { updateAppNameAction } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireUser } from "@/lib/auth";
import { getLdapConfig } from "@/lib/ldap";
import { getNotifyChannelConfig } from "@/lib/notify-channels";
import { getOidcConfig } from "@/lib/oidc";
import { settingGet } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export default async function AdminSettingsPage() {
  const user = await requireUser();
  if (user.global_role !== "admin") redirect("/dashboard");

  const appName = settingGet("app_name") || "Dashboard Local";
  const lastBackup = settingGet("last_backup_at");
  const ldap = getLdapConfig();
  const oidc = getOidcConfig();
  const notify = getNotifyChannelConfig();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Налаштування</h1>

      <Card>
        <CardHeader>
          <CardTitle>Інстанс</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={async (fd) => {
              "use server";
              await updateAppNameAction(fd);
            }}
            className="flex max-w-lg flex-col gap-3"
          >
            <div className="space-y-1">
              <Label>Назва додатку</Label>
              <Input name="app_name" defaultValue={appName} />
            </div>
            <Button type="submit" className="w-fit">
              Зберегти
            </Button>
          </form>
          <p className="mt-4 text-sm text-zinc-500">
            Останній бекап: {lastBackup ? formatDate(lastBackup, true) : "ще не було"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>LDAP bind</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={async (fd) => {
              "use server";
              await updateLdapSettingsAction(fd);
            }}
            className="max-w-2xl space-y-3"
          >
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="ldap_enabled" defaultChecked={ldap.enabled} className="size-4" />
              Увімкнути LDAP
            </label>
            <Input name="ldap_url" placeholder="ldap://dc.example.local:389" defaultValue={ldap.url} />
            <Input name="ldap_base_dn" placeholder="dc=example,dc=local" defaultValue={ldap.baseDn} />
            <Input name="ldap_bind_dn_template" defaultValue={ldap.bindDnTemplate} />
            <Input name="ldap_search_filter" defaultValue={ldap.searchFilter} />
            <Button type="submit">Зберегти LDAP</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>OIDC SSO</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={async (fd) => {
              "use server";
              await updateOidcSettingsAction(fd);
            }}
            className="max-w-2xl space-y-3"
          >
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="oidc_enabled" defaultChecked={oidc.enabled} className="size-4" />
              Увімкнути OIDC SSO
            </label>
            <div className="space-y-1">
              <Label>Issuer URL</Label>
              <Input name="oidc_issuer" placeholder="https://keycloak/.../realms/main" defaultValue={oidc.issuer} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Client ID</Label>
                <Input name="oidc_client_id" defaultValue={oidc.clientId} />
              </div>
              <div className="space-y-1">
                <Label>Client Secret</Label>
                <Input name="oidc_client_secret" type="password" defaultValue={oidc.clientSecret} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Redirect URI</Label>
              <Input name="oidc_redirect_uri" defaultValue={oidc.redirectUri} />
            </div>
            <div className="space-y-1">
              <Label>Scopes</Label>
              <Input name="oidc_scopes" defaultValue={oidc.scopes} />
            </div>
            <Button type="submit">Зберегти OIDC</Button>
          </form>
          <p className="mt-2 text-xs text-zinc-500">
            Працює з Keycloak / Azure AD / Google (OIDC). Callback:{" "}
            <code>/api/auth/oidc/callback</code>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email / Telegram сповіщення</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={async (fd) => {
              "use server";
              await updateNotifySettingsAction(fd);
            }}
            className="max-w-2xl space-y-3"
          >
            <div className="space-y-1">
              <Label>App base URL (для посилань у листах)</Label>
              <Input name="app_base_url" defaultValue={notify.appBaseUrl} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="notify_email_enabled" defaultChecked={notify.emailEnabled} className="size-4" />
              Email (SMTP)
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <Input name="smtp_host" placeholder="smtp.example.com" defaultValue={notify.smtpHost} />
              <Input name="smtp_port" placeholder="587" defaultValue={String(notify.smtpPort)} />
              <Input name="smtp_user" placeholder="user" defaultValue={notify.smtpUser} />
              <Input name="smtp_pass" type="password" placeholder="pass" defaultValue={notify.smtpPass} />
            </div>
            <Input name="smtp_from" placeholder="dashboard@example.com" defaultValue={notify.smtpFrom} />

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="notify_telegram_enabled" defaultChecked={notify.telegramEnabled} className="size-4" />
              Telegram bot
            </label>
            <Input name="telegram_bot_token" placeholder="123:ABC..." defaultValue={notify.telegramBotToken} />
            <Input name="telegram_default_chat" placeholder="Chat ID (опційно)" defaultValue={notify.telegramDefaultChat} />
            <Button type="submit">Зберегти канали</Button>
          </form>
          <form
            action={async () => {
              "use server";
              await sendTestNotificationAction();
            }}
            className="mt-3"
          >
            <Button type="submit" variant="secondary" size="sm">
              Надіслати тест мені (email/Telegram)
            </Button>
          </form>
          <p className="mt-2 text-xs text-zinc-500">
            Персональний Telegram chat id користувач може вказати в Профілі. Для тесту
            потрібен email у профілі адміна та/або telegram chat.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
