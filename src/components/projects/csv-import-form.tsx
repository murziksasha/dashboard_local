"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importCsvAction } from "@/app/actions/import-export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CsvImportForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    created: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        fd.set("projectId", projectId);
        setError(null);
        setResult(null);
        startTransition(async () => {
          const res = await importCsvAction(fd);
          if ("error" in res && res.error) {
            setError(res.error);
            return;
          }
          if ("created" in res) {
            setResult({
              created: res.created,
              skipped: res.skipped,
              errors: res.errors ?? [],
            });
            form.reset();
            router.refresh();
          }
        });
      }}
    >
      <Input name="file" type="file" accept=".csv,text/csv" required />
      <p className="text-xs text-zinc-500">
        Колонки: title, type, priority, description, due_date, labels, status
      </p>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Імпорт..." : "Імпортувати"}
      </Button>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      {result ? (
        <div className="space-y-1 text-xs">
          <p className="text-emerald-600 dark:text-emerald-400">
            Створено: {result.created}, пропущено: {result.skipped}.
          </p>
          {result.errors.length ? (
            <ul className="list-disc pl-4 text-amber-700 dark:text-amber-300">
              {result.errors.slice(0, 5).map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
