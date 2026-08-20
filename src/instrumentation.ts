export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { ensureBackgroundJobs } = await import("./lib/jobs");
  ensureBackgroundJobs();
}
