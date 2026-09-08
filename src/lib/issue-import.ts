import { parseCsv } from "./csv";
import { createIssue } from "./issues";
import { listStatuses } from "./projects";
import type { IssueType, Priority, SessionUser } from "./types";

const TYPES: IssueType[] = ["epic", "story", "task", "bug", "subtask"];
const PRIORITIES: Priority[] = ["highest", "high", "medium", "low", "lowest"];

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

export type ImportResult = {
  created: number;
  skipped: number;
  errors: string[];
};

export function importIssuesFromCsv(params: {
  projectId: string;
  csv: string;
  actor: SessionUser;
}): ImportResult {
  const table = parseCsv(params.csv);
  if (table.length < 2) return { created: 0, skipped: 0, errors: ["Порожній CSV."] };
  const header = table[0]!.map(normHeader);
  const titleIdx = header.findIndex((h) => h === "title" || h === "summary" || h === "заголовок");
  if (titleIdx < 0) return { created: 0, skipped: 0, errors: ["Немає колонки title."] };

  const col = (name: string[]) => header.findIndex((h) => name.includes(h));
  const typeI = col(["type", "тип"]);
  const prioI = col(["priority", "пріоритет"]);
  const descI = col(["description", "опис"]);
  const dueI = col(["due_date", "due", "дедлайн"]);
  const labelsI = col(["labels", "мітки"]);
  const statusI = col(["status", "статус"]);
  const statuses = listStatuses(params.projectId);

  const result: ImportResult = { created: 0, skipped: 0, errors: [] };
  for (let r = 1; r < table.length; r++) {
    const row = table[r]!;
    const title = (row[titleIdx] || "").trim();
    if (!title) {
      result.skipped++;
      continue;
    }
    const typeRaw = (typeI >= 0 ? row[typeI] : "task")?.trim().toLowerCase() || "task";
    const type = TYPES.includes(typeRaw as IssueType) ? (typeRaw as IssueType) : "task";
    const prioRaw = (prioI >= 0 ? row[prioI] : "medium")?.trim().toLowerCase() || "medium";
    const priority = PRIORITIES.includes(prioRaw as Priority) ? (prioRaw as Priority) : "medium";
    const labels = labelsI >= 0 ? (row[labelsI] || "").split(/[;,]/).map((s) => s.trim()).filter(Boolean) : [];
    const statusName = statusI >= 0 ? (row[statusI] || "").trim() : "";
    const statusId = statusName
      ? statuses.find((s) => s.name.toLowerCase() === statusName.toLowerCase())?.id
      : undefined;
    try {
      createIssue({
        projectId: params.projectId,
        type,
        title,
        description: descI >= 0 ? row[descI] || undefined : undefined,
        priority,
        dueDate: dueI >= 0 && row[dueI] ? row[dueI] : null,
        labels,
        statusId,
        reporterId: params.actor.id,
        actor: params.actor,
      });
      result.created++;
    } catch (e) {
      result.errors.push(`Рядок ${r + 1}: ${e instanceof Error ? e.message : String(e)}`);
      if (result.errors.length > 25) break;
    }
  }
  return result;
}
