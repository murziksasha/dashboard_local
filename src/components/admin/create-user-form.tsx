"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createUserAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function CreateUserForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        setError(null);
        setOk(false);
        startTransition(async () => {
          const res = await createUserAction(fd);
          if (res?.error) {
            setError(res.error);
            return;
          }
          setOk(true);
          form.reset();
          router.refresh();
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="login">Логін</Label>
          <Input id="login" name="login" required autoComplete="off" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Імʼя</Label>
          <Input id="name" name="name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Пароль</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="global_role">Роль</Label>
          <Select id="global_role" name="global_role" defaultValue="user">
            <option value="user">Користувач</option>
            <option value="admin">Адміністратор</option>
          </Select>
        </div>
      </div>
      {error ? (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-200">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
          Користувача створено.
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Створення..." : "Створити користувача"}
      </Button>
    </form>
  );
}
