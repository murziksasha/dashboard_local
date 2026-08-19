"use client";

import { useState, useTransition } from "react";
import { loginAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({
  oidcEnabled,
  ldapEnabled,
  errorCode,
}: {
  oidcEnabled?: boolean;
  ldapEnabled?: boolean;
  errorCode?: string | null;
}) {
  const [error, setError] = useState<string | null>(
    errorCode
      ? {
          oidc_disabled: "OIDC вимкнено.",
          oidc_config: "Помилка конфігурації OIDC.",
          oidc_state: "Сесія OIDC застаріла. Спробуйте ще раз.",
          oidc_failed: "Не вдалося увійти через SSO.",
          disabled: "Обліковий запис вимкнено.",
        }[errorCode] || "Помилка входу."
      : null,
  );
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setError(null);
          startTransition(async () => {
            const res = await loginAction(fd);
            if (res?.error) setError(res.error);
          });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="login">Логін</Label>
          <Input id="login" name="login" required autoComplete="username" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Пароль</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </div>
        {error ? (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-200">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Вхід..." : "Увійти"}
        </Button>
      </form>

      {oidcEnabled ? (
        <a
          href="/api/auth/oidc/start"
          className="flex h-9 w-full items-center justify-center rounded-md border border-zinc-300 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Увійти через SSO (OIDC)
        </a>
      ) : null}

      <p className="text-center text-xs text-zinc-500">
        {ldapEnabled
          ? "Доступний локальний логін і LDAP."
          : "Локальний логін."}
        {oidcEnabled ? " OIDC SSO увімкнено." : ""}
      </p>
    </div>
  );
}
