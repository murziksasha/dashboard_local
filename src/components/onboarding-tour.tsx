"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    title: "Дошка",
    body: "Перетягуйте картки між колонками. N — нова задача, ? — список скорочень.",
  },
  {
    title: "Пошук",
    body: "Ctrl+K відкриває глобальний пошук задач, проєктів, людей і коментарів.",
  },
  {
    title: "Фільтри",
    body: "Фільтри дошки зберігаються в URL — поділіться посиланням з командою.",
  },
  {
    title: "Сповіщення",
    body: "Дзвіночок групує оновлення по задачі. Email/Telegram налаштовуються в профілі.",
  },
];

export function OnboardingTour() {
  const [step, setStep] = useState<number | null>(null);
  useEffect(() => {
    try {
      if (localStorage.getItem("dl_tour_v1")) return;
      setStep(0);
    } catch {
      // ignore
    }
  }, []);
  if (step == null || !STEPS[step]) return null;
  const s = STEPS[step];
  function finish() {
    try {
      localStorage.setItem("dl_tour_v1", "1");
    } catch {
      // ignore
    }
    setStep(null);
  }
  return (
    <div className="fixed inset-x-0 bottom-4 z-[70] mx-auto w-[min(100%-1.5rem,28rem)] rounded-xl border border-sky-200 bg-white p-4 shadow-xl dark:border-sky-900 dark:bg-zinc-900">
      <p className="text-sm font-semibold">{s.title}</p>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{s.body}</p>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-zinc-400">
          {step + 1} / {STEPS.length}
        </span>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={finish}>
            Пропустити
          </Button>
          {step + 1 < STEPS.length ? (
            <Button type="button" size="sm" onClick={() => setStep(step + 1)}>
              Далі
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={finish}>
              Зрозуміло
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
