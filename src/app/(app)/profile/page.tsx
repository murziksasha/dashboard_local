import { requireUser } from "@/lib/auth";
import { get, settingGet } from "@/lib/db";
import { ProfileForms } from "@/components/profile/profile-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ProfilePage() {
  const user = await requireUser();
  const row = get<{
    name: string;
    email: string | null;
    login: string;
  }>(`SELECT name, email, login FROM users WHERE id = ?`, [user.id])!;
  const telegramChat = settingGet(`telegram_chat_${user.id}`) || "";

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Профіль</h1>
        <p className="text-sm text-zinc-500">Логін: @{row.login}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Особисті дані та пароль</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForms
            name={row.name}
            email={row.email}
            telegramChat={telegramChat}
          />
        </CardContent>
      </Card>
    </div>
  );
}
