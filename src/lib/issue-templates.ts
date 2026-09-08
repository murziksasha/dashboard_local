import { all, get, nowIso, run } from "./db";
import { createId } from "./id";
import type { IssueType, Priority } from "./types";

export type IssueTemplate = {
  id: string;
  project_id: string;
  name: string;
  type: IssueType;
  title: string | null;
  description: string | null;
  priority: Priority;
  labels: string | null;
  created_at: string;
};

export const BUILTIN_TEMPLATES: Array<
  Omit<IssueTemplate, "id" | "project_id" | "created_at">
> = [
  {
    name: "Bug Report",
    type: "bug",
    title: "",
    description:
      "## Кроки відтворення\n1. \n2. \n\n## Очікувана поведінка\n\n## Фактична поведінка\n\n## Середовище\n",
    priority: "high",
    labels: "bug",
  },
  {
    name: "Feature Request",
    type: "story",
    title: "",
    description: "## Проблема\n\n## Пропозиція\n\n## Критерії готовності\n- [ ] \n",
    priority: "medium",
    labels: "feature",
  },
  {
    name: "Task",
    type: "task",
    title: "",
    description: "## Мета\n\n## Кроки\n- [ ] \n",
    priority: "medium",
    labels: null,
  },
];

export function listIssueTemplates(projectId: string): IssueTemplate[] {
  return all<IssueTemplate>(
    `SELECT id, project_id, name, type, title, description, priority, labels, created_at
     FROM issue_templates WHERE project_id = ? ORDER BY name`,
    [projectId],
  );
}

export function getIssueTemplate(id: string): IssueTemplate | undefined {
  return get<IssueTemplate>(`SELECT * FROM issue_templates WHERE id = ?`, [id]);
}

export function createIssueTemplate(params: {
  projectId: string;
  name: string;
  type?: IssueType;
  title?: string | null;
  description?: string | null;
  priority?: Priority;
  labels?: string | null;
}): IssueTemplate {
  const id = createId("tpl");
  const ts = nowIso();
  run(
    `INSERT INTO issue_templates (id, project_id, name, type, title, description, priority, labels, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.projectId,
      params.name.trim(),
      params.type || "task",
      params.title?.trim() || null,
      params.description ?? null,
      params.priority || "medium",
      params.labels?.trim() || null,
      ts,
    ],
  );
  return getIssueTemplate(id)!;
}

export function deleteIssueTemplate(id: string) {
  run(`DELETE FROM issue_templates WHERE id = ?`, [id]);
}

export function seedBuiltinTemplates(projectId: string) {
  const existing = listIssueTemplates(projectId);
  if (existing.length) return existing;
  for (const t of BUILTIN_TEMPLATES) {
    createIssueTemplate({ projectId, ...t });
  }
  return listIssueTemplates(projectId);
}
