"use client";

import { useId, useRef, type ReactNode } from "react";
import { useOverlayLock } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useOverlayLock(open, onClose, ref);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Закрити"
        onClick={onClose}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={cn(
          "absolute inset-x-0 bottom-0 flex max-h-[92vh] flex-col overflow-hidden rounded-t-xl border border-zinc-200 bg-white shadow-2xl",
          "md:inset-y-0 md:bottom-auto md:left-auto md:right-0 md:h-full md:w-[min(100%,40rem)] md:rounded-none md:border-l",
          "dark:border-zinc-800 dark:bg-zinc-950",
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2 id={titleId} className="truncate text-base font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        {footer ? (
          <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
