"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { assertMinRole } from "@/lib/permissions";
import {
  createWorkflowRule,
  deleteWorkflowRule,
} from "@/lib/workflow";

export async function createWorkflowRuleAction(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") || "");
  assertMinRole(user, projectId, "lead");
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Назва правила обовʼязкова.");
  createWorkflowRule({
    projectId,
    name,
    fromStatusId: String(formData.get("fromStatusId") || "") || null,
    toStatusId: String(formData.get("toStatusId") || "") || null,
    requireAssignee: formData.get("requireAssignee") === "on",
    requireDueDate: formData.get("requireDueDate") === "on",
    blockIfOpenBlockers: formData.get("blockIfOpenBlockers") === "on",
    onlyRoles: formData
      .getAll("onlyRoles")
      .map(String)
      .filter(Boolean),
  });
  revalidatePath(`/projects/${projectId}/settings`);
}

export async function deleteWorkflowRuleAction(
  projectId: string,
  ruleId: string,
) {
  const user = await requireUser();
  assertMinRole(user, projectId, "lead");
  deleteWorkflowRule(ruleId, projectId);
  revalidatePath(`/projects/${projectId}/settings`);
}
