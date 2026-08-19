"use client";

import { useState, useTransition } from "react";
import { setupAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SetupForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const res = await setupAction(fd);
          if (res?.error) setError(res.error);
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="appName">Назва інстансу</Label>
        <Input id="appName" name="appName" defaultValue="Dashboard Local" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Імʼя адміністратора</Label>
        <Input id="name" name="name" required placeholder="Олена Коваль" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="login">Логін</Label>
        <Input id="login" name="login" required placeholder="admin" autoComplete="username" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Пароль</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="demo" defaultChecked className="size-4 rounded" />
        Завантажити демо-проєкт і користувача demo / demo1234
      </label>
      {error ? (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-200">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Налаштування..." : "Завершити налаштування"}
      </Button>
    </form>
  );
}
