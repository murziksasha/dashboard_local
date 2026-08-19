"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAppNameAction } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AppNameForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        setOk(false);
        startTransition(async () => {
          const res = await updateAppNameAction(fd);
          if (res?.error) setError(res.error);
          else {
            setOk(true);
            router.refresh();
          }
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="app_name">Назва застосунку</Label>
        <Input
          id="app_name"
          name="app_name"
          defaultValue={initialName}
          required
          maxLength={80}
        />
      </div>
      {error ? (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-200">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
          Збережено.
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Збереження..." : "Зберегти"}
      </Button>
    </form>
  );
}
