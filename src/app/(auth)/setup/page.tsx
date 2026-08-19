import { redirect } from "next/navigation";
import { SetupForm } from "@/components/setup-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isSetupComplete } from "@/lib/auth";

export default function SetupPage() {
  if (isSetupComplete()) redirect("/login");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 via-white to-violet-50 p-4 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Ласкаво просимо до Dashboard Local</CardTitle>
          <CardDescription>
            Перший запуск: створіть адміністратора. Далі доступ буде в локальній мережі через
            браузер.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SetupForm />
        </CardContent>
      </Card>
    </div>
  );
}
