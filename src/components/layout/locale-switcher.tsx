"use client";

import { useTransition } from "react";
import { setLocaleAction } from "@/app/actions/locale";
import { LOCALES, type Locale } from "@/lib/i18n";

const LABELS: Record<Locale, string> = { uk: "UK", en: "EN", ru: "RU" };

export function LocaleSwitcher({ value }: { value: Locale }) {
  const [, start] = useTransition();
  return (
    <select
      aria-label="Language"
      className="h-8 rounded-md border border-zinc-200 bg-transparent px-1 text-xs dark:border-zinc-700"
      value={value}
      onChange={(e) =>
        start(async () => {
          await setLocaleAction(e.target.value);
        })
      }
    >
      {LOCALES.map((l) => (
        <option key={l} value={l}>
          {LABELS[l]}
        </option>
      ))}
    </select>
  );
}
