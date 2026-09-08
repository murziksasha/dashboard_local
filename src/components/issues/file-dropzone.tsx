"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function FileDropzone({
  onFiles,
  disabled,
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}) {
  const [over, setOver] = useState(false);
  return (
    <label
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-3 py-4 text-center text-xs text-zinc-500",
        over && "border-sky-500 bg-sky-50 dark:bg-sky-950/30",
        disabled && "pointer-events-none opacity-60",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const files = [...e.dataTransfer.files];
        if (files.length) onFiles(files);
      }}
    >
      Перетягніть файли сюди або натисніть, щоб обрати
      <input
        type="file"
        multiple
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const files = [...(e.target.files || [])];
          if (files.length) onFiles(files);
          e.currentTarget.value = "";
        }}
      />
    </label>
  );
}
