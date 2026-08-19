"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addTeamMemberAction,
  removeTeamMemberAction,
} from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

type UserOption = { id: string; name: string; login: string };

export function TeamMemberControls({
  teamId,
  members,
  candidates,
}: {
  teamId: string;
  members: UserOption[];
  candidates: UserOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <ul className="space-y-1">
        {members.length === 0 ? (
          <li className="text-sm text-zinc-500">Немає учасників.</li>
        ) : (
          members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-2 rounded-md border border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-800"
            >
              <span>
                {m.name}{" "}
                <span className="text-zinc-500">@{m.login}</span>
              </span>
              <Button
                type="button"
                size="sm"
                variant="danger"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    await removeTeamMemberAction(teamId, m.id);
                    router.refresh();
                  });
                }}
              >
                Прибрати
              </Button>
            </li>
          ))
        )}
      </ul>

      {candidates.length > 0 ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const userId = String(fd.get("userId") || "");
            if (!userId) return;
            startTransition(async () => {
              await addTeamMemberAction(teamId, userId);
              e.currentTarget.reset();
              router.refresh();
            });
          }}
        >
          <Select name="userId" defaultValue="" required className="max-w-xs">
            <option value="" disabled>
              Додати учасника…
            </option>
            {candidates.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} (@{u.login})
              </option>
            ))}
          </Select>
          <Button type="submit" size="sm" disabled={pending}>
            Додати
          </Button>
        </form>
      ) : null}
    </div>
  );
}
