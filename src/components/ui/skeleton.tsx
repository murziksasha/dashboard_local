import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800", className)} />;
}

export function IssueListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          <Skeleton className="mb-2 h-3 w-20" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}

export function BoardSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-3 md:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-2 rounded-xl border border-zinc-200 p-2 dark:border-zinc-800">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ))}
    </div>
  );
}
