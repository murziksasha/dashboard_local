import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  default: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100",
  sky: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  rose: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
  amber: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  emerald:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  violet:
    "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
};

export function Badge({
  className,
  tone = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof styles }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        styles[tone],
        className,
      )}
      {...props}
    />
  );
}
