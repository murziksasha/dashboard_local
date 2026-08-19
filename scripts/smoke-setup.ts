/**
 * One-shot local smoke: create admin + demo if DB not set up yet.
 * Usage: npx tsx scripts/smoke-setup.ts
 */
import { hashPassword, isSetupComplete } from "../src/lib/auth";
import { get, nowIso, run, settingSet } from "../src/lib/db";
import { createId } from "../src/lib/id";
import { seedDemo } from "../src/lib/seed";
import type { SessionUser } from "../src/lib/types";

if (isSetupComplete()) {
  const admin = get<{ id: string; login: string }>(
    `SELECT id, login FROM users WHERE global_role = 'admin' LIMIT 1`,
  );
  console.log("Already set up. Admin:", admin?.login);
  process.exit(0);
}

const id = createId("usr");
const ts = nowIso();
run(
  `INSERT INTO users (id, login, name, email, password_hash, global_role, active, created_at, updated_at)
   VALUES (?, 'admin', 'Адмін', NULL, ?, 'admin', 1, ?, ?)`,
  [id, hashPassword("admin123"), ts, ts],
);
settingSet("setup_complete", "1");
settingSet("app_name", "Dashboard Local");

const admin: SessionUser = {
  id,
  login: "admin",
  name: "Адмін",
  email: null,
  global_role: "admin",
};
const demo = seedDemo(admin);
console.log("Setup OK");
console.log("Admin: admin / admin123");
console.log("Demo user:", demo.demoLogin, "/", demo.demoPassword);
console.log("Demo project id:", demo.projectId);
