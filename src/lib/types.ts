export type GlobalRole = "admin" | "user";
export type ProjectRole = "lead" | "member" | "viewer";
export type IssueType = "epic" | "story" | "task" | "bug" | "subtask";
export type Priority = "highest" | "high" | "medium" | "low" | "lowest";
export type StatusCategory = "todo" | "in_progress" | "done";
export type SprintStatus = "future" | "active" | "closed";
export type LinkType = "blocks" | "relates" | "duplicates";
export type CustomFieldType = "text" | "number" | "select" | "date" | "user";

export interface User {
  id: string;
  login: string;
  name: string;
  email: string | null;
  global_role: GlobalRole;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface SessionUser {
  id: string;
  login: string;
  name: string;
  email: string | null;
  global_role: GlobalRole;
}

export interface Project {
  id: string;
  key: string;
  name: string;
  description: string | null;
  lead_id: string | null;
  issue_seq: number;
  archived: number;
  board_version: number;
  created_at: string;
  updated_at: string;
}

export interface Status {
  id: string;
  project_id: string;
  name: string;
  category: StatusCategory;
  position: number;
  wip_limit: number | null;
}

export interface Issue {
  id: string;
  project_id: string;
  key: string;
  type: IssueType;
  title: string;
  description: string | null;
  status_id: string;
  priority: Priority;
  assignee_id: string | null;
  reporter_id: string | null;
  parent_id: string | null;
  epic_id: string | null;
  sprint_id: string | null;
  story_points: number | null;
  original_estimate_sec: number | null;
  remaining_estimate_sec: number | null;
  start_date: string | null;
  due_date: string | null;
  rank: string;
  created_at: string;
  updated_at: string;
}

export interface IssueFilter {
  q?: string;
  types?: IssueType[];
  excludeTypes?: IssueType[];
  statusIds?: string[];
  assigneeIds?: Array<string | "unassigned">;
  priorities?: Priority[];
  labels?: string[];
  sprintId?: string | "backlog" | "any";
  epicId?: string;
  due?: "overdue" | "week" | "none";
  sort?: "rank" | "key" | "updated" | "created" | "due" | "priority";
  dir?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  highest: "Найвищий",
  high: "Високий",
  medium: "Середній",
  low: "Низький",
  lowest: "Найнижчий",
};

export const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  epic: "Epic",
  story: "Story",
  task: "Задача",
  bug: "Баг",
  subtask: "Підзадача",
};

export const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
  lead: "Керівник",
  member: "Учасник",
  viewer: "Спостерігач",
};

export const DEFAULT_STATUSES: Array<{
  name: string;
  category: StatusCategory;
}> = [
  { name: "Backlog", category: "todo" },
  { name: "To Do", category: "todo" },
  { name: "In Progress", category: "in_progress" },
  { name: "Review", category: "in_progress" },
  { name: "Done", category: "done" },
];
