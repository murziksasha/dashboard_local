"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createBackupAction,
  restoreBackupAction,
} from "@/app/actions/backup";
import { Button } from "@/components/ui/button";

export function CreateBackupButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <Button
        type="button"
        disabled={pending}
        onClick={() => {
          setMsg(null);
          startTransition(async () => {
            const res = await createBackupAction();
            if (res?.ok) {
              setMsg(`Створено: ${res.name}`);
              router.refresh();
            }
          });
        }}
      >
        {pending ? "Створення..." : "Створити бекап"}
      </Button>
      {msg ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">{msg}</p>
      ) : null}
    </div>
  );
}

export function RestoreBackupButton({ filename }: { filename: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <Button
        type="button"
        size="sm"
        variant="danger"
        disabled={pending}
        onClick={() => {
          const ok = window.confirm(
            `Відновити базу з «${filename}»?\nПоточні дані будуть перезаписані.`,
          );
          if (!ok) return;
          setError(null);
          startTransition(async () => {
            try {
              await restoreBackupAction(filename);
              router.refresh();
            } catch {
              setError("Не вдалося відновити бекап.");
            }
          });
        }}
      >
        {pending ? "Відновлення..." : "Відновити"}
      </Button>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
