import { createId } from "../src/lib/id";
import { get, nowIso, run } from "../src/lib/db";

const admin = get<{ id: string }>(`SELECT id FROM users WHERE login = ?`, [
  "admin",
]);
if (!admin) {
  console.error("No admin user");
  process.exit(1);
}
const sid = createId("ses");
const exp = new Date();
exp.setDate(exp.getDate() + 14);
run(
  `INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`,
  [sid, admin.id, exp.toISOString(), nowIso()],
);
process.stdout.write(sid);
