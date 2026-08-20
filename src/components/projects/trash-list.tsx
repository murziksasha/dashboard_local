"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { purgeIssueAction, restoreIssueAction } from "@/app/actions/issues";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";

export function TrashList({
  items,
}: {
  items: Array<{ id: string; key: string; title: string; deleted_at: string }>;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [purgeId, setPurgeId] = useState<string | null>(null);
  const target = items.find((i) => i.id === purgeId);

  return (
    <>
      <div className="space-y-2">
        {items.map((i) => (
          <div
            key={i.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800"
          >
            <div>
              <p className="font-medium text-sky-600">{i.key}</p>
              <p className="text-sm">{i.title}</p>
              <p className="text-xs text-zinc-400">{formatDate(i.deleted_at, true)}</p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() =>
                  startTransition(async () => {
                    await restoreIssueAction(i.id);
                    router.refresh();
                  })
                }
              >
                Відновити
              </Button>
              <Button type="button" size="sm" variant="danger" onClick={() => setPurgeId(i.id)}>
                Видалити назавжди
              </Button>
            </div>
          </div>
        ))}
      </div>
      <Dialog
        open={!!target}
        onClose={() => setPurgeId(null)}
        title={target ? `Видалити ${target.key} назавжди?` : "Видалити"}
      >
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-300">
          Задачу, коментарі та файли буде стерто. Цю дію не можна скасувати.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setPurgeId(null)}>
            Скасувати
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              if (!purgeId) return;
              const id = purgeId;
              setPurgeId(null);
              startTransition(async () => {
                await purgeIssueAction(id);
                router.refresh();
              });
            }}
          >
            Видалити назавжди
          </Button>
        </div>
      </Dialog>
    </>
  );
}
