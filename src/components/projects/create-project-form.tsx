"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createProjectAction } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CreateProjectForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 md:grid-cols-4 dark:border-zinc-800 dark:bg-zinc-900"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const res = await createProjectAction(fd);
          if (res?.error) setError(res.error);
          else if (res?.id) router.push(`/projects/${res.id}`);
          else router.refresh();
        });
      }}
    >
      <div className="space-y-1">
        <Label>Ключ</Label>
        <Input name="key" placeholder="PROJ" required />
      </div>
      <div className="space-y-1 md:col-span-2">
        <Label>Назва</Label>
        <Input name="name" required />
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "..." : "Створити проєкт"}
        </Button>
      </div>
      <div className="space-y-1 md:col-span-4">
        <Label>Опис</Label>
        <Textarea name="description" rows={2} />
      </div>
      {error ? <p className="text-sm text-rose-600 md:col-span-4">{error}</p> : null}
    </form>
  );
}
