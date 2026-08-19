"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTeamAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type UserOption = { id: string; name: string; login: string };

export function CreateTeamForm({ users }: { users: UserOption[] }) {
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
          const res = await createTeamAction(fd);
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
      <div className="space-y-2">
        <Label htmlFor="name">Назва</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Опис</Label>
        <Textarea id="description" name="description" rows={2} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="members">Учасники</Label>
        <select
          id="members"
          name="members"
          multiple
          className="min-h-[120px] w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-zinc-700 dark:bg-zinc-950"
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} (@{u.login})
            </option>
          ))}
        </select>
        <p className="text-xs text-zinc-500">
          Утримуйте Ctrl / Cmd, щоб обрати кількох.
        </p>
      </div>
      {error ? (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-200">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
          Команду створено.
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Створення..." : "Створити команду"}
      </Button>
    </form>
  );
}
