"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  resetPasswordAction,
  toggleUserActiveAction,
} from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UserRowActions({
  userId,
  active,
}: {
  userId: string;
  active: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [showReset, setShowReset] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={active ? "outline" : "default"}
          disabled={pending}
          onClick={() => {
            setError(null);
            setMsg(null);
            startTransition(async () => {
              const res = await toggleUserActiveAction(userId, !active);
              if (res?.error) setError(res.error);
              else {
                setMsg(active ? "Деактивовано." : "Активовано.");
                router.refresh();
              }
            });
          }}
        >
          {active ? "Деактивувати" : "Активувати"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => {
            setShowReset((v) => !v);
            setError(null);
            setMsg(null);
          }}
        >
          Скинути пароль
        </Button>
      </div>

      {showReset ? (
        <form
          className="flex flex-wrap items-end gap-2 rounded-md border border-zinc-200 p-2 dark:border-zinc-800"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("userId", userId);
            setError(null);
            setMsg(null);
            startTransition(async () => {
              const res = await resetPasswordAction(fd);
              if (res?.error) setError(res.error);
              else {
                setMsg("Пароль оновлено.");
                e.currentTarget.reset();
                setShowReset(false);
              }
            });
          }}
        >
          <div className="space-y-1">
            <Label htmlFor={`pwd-${userId}`}>Новий пароль</Label>
            <Input
              id={`pwd-${userId}`}
              name="password"
              type="password"
              minLength={6}
              required
            />
          </div>
          <Button type="submit" size="sm" disabled={pending}>
            Зберегти
          </Button>
        </form>
      ) : null}

      {error ? (
        <p className="text-xs text-rose-600">{error}</p>
      ) : null}
      {msg ? <p className="text-xs text-emerald-600">{msg}</p> : null}
    </div>
  );
}
