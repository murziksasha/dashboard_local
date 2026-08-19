"use client";

import { useState, useTransition } from "react";
import { saveFilterAction } from "@/app/actions/filters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SaveFilterForm({
  projectId,
  queryJson,
}: {
  projectId: string;
  queryJson: string;
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("projectId", projectId);
        fd.set("queryJson", queryJson);
        startTransition(async () => {
          const res = await saveFilterAction(fd);
          setMsg(res?.error || "Фільтр збережено");
        });
      }}
    >
      <Input name="name" placeholder="Назва збереженого фільтра" required className="w-56" />
      <label className="flex items-center gap-1 text-xs text-zinc-500">
        <input type="checkbox" name="shared" /> Спільний
      </label>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Зберегти view
      </Button>
      {msg ? <span className="text-xs text-zinc-500">{msg}</span> : null}
    </form>
  );
}
