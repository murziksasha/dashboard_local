import { loadEnv } from "./lib/env";
import { ensureBackgroundJobs } from "./lib/jobs";
import { log } from "./lib/logger";
import { backfillIssueFts } from "./lib/search";

loadEnv();
ensureBackgroundJobs();
try {
  backfillIssueFts();
} catch (e) {
  log.caught("fts.backfill", e);
}
