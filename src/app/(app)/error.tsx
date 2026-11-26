"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App route error:", error.message);
  }, [error]);

  return (
    <div className="mx-auto my-12 max-w-md rounded-xl border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-900 dark:bg-rose-950/30">
      <h2 className="text-lg font-semibold text-rose-800 dark:text-rose-200">
        Щось пішло не так
      </h2>
      <p className="mt-2 text-sm text-rose-700 dark:text-rose-300">
        Виникла помилка під час завантаження сторінки.
      </p>
      <div className="mt-4 flex justify-center">
        <Button type="button" onClick={() => reset()}>
          Спробувати ще раз
        </Button>
      </div>
    </div>
  );
}
