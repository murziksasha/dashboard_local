import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value?: string | null, withTime = false): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime
      ? { hour: "2-digit", minute: "2-digit" }
      : {}),
  }).format(d);
}

export function formatDuration(seconds?: number | null): string {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h && m) return `${h}г ${m}хв`;
  if (h) return `${h}г`;
  if (m) return `${m}хв`;
  return `${seconds}с`;
}

export function parseDurationToSeconds(input: string): number | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Number(raw) * 60;
  let total = 0;
  const hour = raw.match(/(\d+)\s*г/);
  const min = raw.match(/(\d+)\s*х/);
  const sec = raw.match(/(\d+)\s*с/);
  const enH = raw.match(/(\d+)\s*h/);
  const enM = raw.match(/(\d+)\s*m/);
  if (hour) total += Number(hour[1]) * 3600;
  if (enH) total += Number(enH[1]) * 3600;
  if (min) total += Number(min[1]) * 60;
  if (enM) total += Number(enM[1]) * 60;
  if (sec) total += Number(sec[1]);
  return total || null;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
