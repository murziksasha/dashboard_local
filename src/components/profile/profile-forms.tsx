"use client";

import { useState, useTransition } from "react";
import { updateTelegramChatAction } from "@/app/actions/integration-settings";
import {
  changeOwnPasswordAction,
  updateNotifyPrefsAction,
  updateProfileAction,
} from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileForms({
  name,
  email,
  telegramChat,
  notifyPrefs,
}: {
  name: string;
  email: string | null;
  telegramChat?: string;
  notifyPrefs?: Record<string, boolean>;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-8">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setErr(null);
          setMsg(null);
          startTransition(async () => {
            const res = await updateProfileAction(fd);
            if (res?.error) setErr(res.error);
            else setMsg("Профіль збережено.");
          });
        }}
      >
        <div className="space-y-1">
          <Label>Імʼя</Label>
          <Input name="name" defaultValue={name} required />
        </div>
        <div className="space-y-1">
          <Label>Email</Label>
          <Input name="email" type="email" defaultValue={email || ""} />
        </div>
        <Button type="submit" disabled={pending}>
          Зберегти профіль
        </Button>
      </form>

      <form
        className="space-y-3 border-t border-zinc-200 pt-6 dark:border-zinc-800"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setErr(null);
          setMsg(null);
          startTransition(async () => {
            const res = await changeOwnPasswordAction(fd);
            if (res?.error) setErr(res.error);
            else {
              setMsg("Пароль змінено.");
              e.currentTarget.reset();
            }
          });
        }}
      >
        <h3 className="font-semibold">Зміна пароля</h3>
        <div className="space-y-1">
          <Label>Поточний пароль</Label>
          <Input name="current_password" type="password" required />
        </div>
        <div className="space-y-1">
          <Label>Новий пароль</Label>
          <Input name="new_password" type="password" minLength={6} required />
        </div>
        <div className="space-y-1">
          <Label>Підтвердження</Label>
          <Input name="confirm_password" type="password" minLength={6} required />
        </div>
        <Button type="submit" variant="secondary" disabled={pending}>
          Змінити пароль
        </Button>
      </form>

      <form
        className="space-y-3 border-t border-zinc-200 pt-6 dark:border-zinc-800"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setErr(null);
          setMsg(null);
          startTransition(async () => {
            await updateTelegramChatAction(fd);
            setMsg("Telegram chat збережено.");
          });
        }}
      >
        <h3 className="font-semibold">Telegram chat ID</h3>
        <Input
          name="telegram_chat"
          placeholder="Напр. 123456789"
          defaultValue={telegramChat || ""}
        />
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          Зберегти Telegram
        </Button>
      </form>

      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setErr(null);
          setMsg(null);
          startTransition(async () => {
            await updateNotifyPrefsAction(fd);
            setMsg("Налаштування сповіщень збережено.");
          });
        }}
      >
        <h3 className="font-semibold">Сповіщення</h3>
        {(
          [
            ["assigned", "Призначення"],
            ["comment", "Коментарі"],
            ["mention", "Згадки"],
            ["status", "Зміна статусу"],
            ["due_soon", "Дедлайн"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name={key}
              defaultChecked={notifyPrefs?.[key] !== false}
            />
            {label}
          </label>
        ))}
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          Зберегти сповіщення
        </Button>
      </form>

      {err ? <p className="text-sm text-rose-600">{err}</p> : null}
      {msg ? <p className="text-sm text-emerald-600">{msg}</p> : null}
    </div>
  );
}
