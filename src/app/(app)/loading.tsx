export default function AppLoading() {
  return (
    <div className="space-y-4 p-2">
      <div className="h-8 w-48 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-28 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-28 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-28 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}
