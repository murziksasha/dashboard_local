import { all, get, run } from "./db";
import { createId } from "./id";
import { getIssueAssignees } from "./assignees";

export type WorkflowRule = {
  id: string;
  project_id: string;
  name: string;
  from_status_id: string | null;
  to_status_id: string | null;
  require_assignee: number;
  require_due_date: number;
  block_if_open_blockers: number;
  only_roles: string | null; // csv: lead,member
  enabled: number;
};

export function listWorkflowRules(projectId: string): WorkflowRule[] {
  return all<WorkflowRule>(
    `SELECT * FROM workflow_rules WHERE project_id = ? ORDER BY name`,
    [projectId],
  );
}

export function createWorkflowRule(input: {
  projectId: string;
  name: string;
  fromStatusId?: string | null;
  toStatusId?: string | null;
  requireAssignee?: boolean;
  requireDueDate?: boolean;
  blockIfOpenBlockers?: boolean;
  onlyRoles?: string[];
}) {
  const id = createId("wfr");
  run(
    `INSERT INTO workflow_rules (
      id, project_id, name, from_status_id, to_status_id,
      require_assignee, require_due_date, block_if_open_blockers, only_roles, enabled
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      id,
      input.projectId,
      input.name,
      input.fromStatusId ?? null,
      input.toStatusId ?? null,
      input.requireAssignee ? 1 : 0,
      input.requireDueDate ? 1 : 0,
      input.blockIfOpenBlockers ? 1 : 0,
      input.onlyRoles?.length ? input.onlyRoles.join(",") : null,
    ],
  );
  return id;
}

export function deleteWorkflowRule(id: string, projectId: string) {
  run(`DELETE FROM workflow_rules WHERE id = ? AND project_id = ?`, [
    id,
    projectId,
  ]);
}

/**
 * Validate a status transition. Throws Error with Ukrainian message if blocked.
 */
export function assertTransitionAllowed(params: {
  projectId: string;
  issueId: string;
  fromStatusId: string;
  toStatusId: string;
  actorRole: "lead" | "member" | "viewer" | null;
}) {
  if (params.fromStatusId === params.toStatusId) return;

  const rules = all<WorkflowRule>(
    `SELECT * FROM workflow_rules
     WHERE project_id = ? AND enabled = 1
       AND (from_status_id IS NULL OR from_status_id = ?)
       AND (to_status_id IS NULL OR to_status_id = ?)`,
    [params.projectId, params.fromStatusId, params.toStatusId],
  );

  if (!rules.length) return;

  const issue = get<{ due_date: string | null }>(
    `SELECT due_date FROM issues WHERE id = ?`,
    [params.issueId],
  );
  const assignees = getIssueAssignees(params.issueId);

  for (const rule of rules) {
    if (rule.only_roles) {
      const allowed = rule.only_roles.split(",").map((s) => s.trim());
      if (!params.actorRole || !allowed.includes(params.actorRole)) {
        throw new Error(
          `Workflow «${rule.name}»: потрібна роль ${allowed.join("/")}.`,
        );
      }
    }
    if (rule.require_assignee && assignees.length === 0) {
      throw new Error(
        `Workflow «${rule.name}»: потрібен хоча б один виконавець.`,
      );
    }
    if (rule.require_due_date && !issue?.due_date) {
      throw new Error(`Workflow «${rule.name}»: потрібен due date.`);
    }
    if (rule.block_if_open_blockers) {
      const openBlockers = get<{ c: number }>(
        `SELECT COUNT(*) as c
         FROM issue_links l
         JOIN issues bi ON bi.id = l.from_issue_id
         JOIN statuses bs ON bs.id = bi.status_id
         WHERE l.to_issue_id = ? AND l.link_type = 'blocks' AND bs.category != 'done'`,
        [params.issueId],
      )?.c;
      if (openBlockers && openBlockers > 0) {
        throw new Error(
          `Workflow «${rule.name}»: є відкриті blockers (${openBlockers}).`,
        );
      }
    }
  }
}
