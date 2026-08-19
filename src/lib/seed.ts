import { createIssue } from "./issues";
import { hashPassword } from "./auth";
import { createId } from "./id";
import { nowIso, run } from "./db";
import { createProject } from "./projects";
import type { SessionUser } from "./types";

export function seedDemo(admin: SessionUser) {
  const memberId = createId("usr");
  const ts = nowIso();
  run(
    `INSERT INTO users (id, login, name, email, password_hash, global_role, active, created_at, updated_at)
     VALUES (?, 'demo', 'Демо Користувач', 'demo@local', ?, 'user', 1, ?, ?)`,
    [memberId, hashPassword("demo1234"), ts, ts],
  );

  const teamId = createId("team");
  run(
    `INSERT INTO teams (id, name, description, created_at) VALUES (?, ?, ?, ?)`,
    [teamId, "Продуктова команда", "Демо-команда для ознайомлення", ts],
  );
  run(`INSERT INTO team_members (team_id, user_id) VALUES (?, ?)`, [
    teamId,
    admin.id,
  ]);
  run(`INSERT INTO team_members (team_id, user_id) VALUES (?, ?)`, [
    teamId,
    memberId,
  ]);

  const project = createProject({
    key: "DEMO",
    name: "Демо проєкт",
    description: "Приклад проєкту Dashboard Local з готовими задачами.",
    leadId: admin.id,
    actor: admin,
    memberIds: [memberId],
  });

  run(
    `INSERT INTO project_teams (project_id, team_id, role) VALUES (?, ?, 'member')`,
    [project.id, teamId],
  );

  const sprintId = createId("spr");
  run(
    `INSERT INTO sprints (id, project_id, name, goal, start_date, end_date, status, created_at)
     VALUES (?, ?, ?, ?, date('now'), date('now', '+14 day'), 'active', ?)`,
    [
      sprintId,
      project.id,
      "Спринт 1",
      "Запустити локальний трекер задач",
      ts,
    ],
  );

  const samples: Array<{
    type: "epic" | "story" | "task" | "bug";
    title: string;
    assigneeId?: string;
    sprint?: boolean;
  }> = [
    { type: "epic", title: "Локальний запуск у мережі" },
    {
      type: "story",
      title: "Налаштувати доступ по LAN",
      assigneeId: admin.id,
      sprint: true,
    },
    {
      type: "task",
      title: "Відкрити порт у Windows Firewall",
      assigneeId: memberId,
      sprint: true,
    },
    {
      type: "bug",
      title: "Перевірити відображення на мобільному",
      assigneeId: memberId,
    },
    { type: "task", title: "Створити бекап бази даних", assigneeId: admin.id },
  ];

  let epicId: string | undefined;
  for (const sample of samples) {
    const issue = createIssue({
      projectId: project.id,
      type: sample.type,
      title: sample.title,
      description: "Автоматично згенерована демо-задача.",
      reporterId: admin.id,
      assigneeId: sample.assigneeId ?? null,
      sprintId: sample.sprint ? sprintId : null,
      epicId: sample.type !== "epic" ? epicId : null,
      labels: sample.type === "bug" ? ["ui"] : ["demo"],
      actor: admin,
    });
    if (sample.type === "epic") epicId = issue.id;
  }

  return { projectId: project.id, demoLogin: "demo", demoPassword: "demo1234" };
}
