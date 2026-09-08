import fs from "fs";
import { getDb } from "./db";
import { getDataDir, getDbPath, getUploadsDir } from "./paths";

const startedAt = Date.now();

function dirSize(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  const walk = (p: string) => {
    try {
      const st = fs.statSync(p);
      if (st.isDirectory()) {
        for (const name of fs.readdirSync(p)) walk(`${p}/${name}`.replace(/\\/g, "/"));
      } else total += st.size;
    } catch {
      // ignore
    }
  };
  walk(dir);
  return total;
}

export function getHealth() {
  let db = "ok";
  try {
    getDb().prepare("SELECT 1").get();
  } catch {
    db = "error";
  }
  let dbBytes = 0;
  try {
    dbBytes = fs.statSync(getDbPath()).size;
  } catch {
    // ignore
  }
  return {
    ok: db === "ok",
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    db,
    disk: {
      dataBytes: dirSize(getDataDir()),
      dbBytes,
      uploadsBytes: dirSize(getUploadsDir()),
    },
    now: new Date().toISOString(),
  };
}
