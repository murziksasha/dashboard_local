"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  reorderWidgets,
  setWidgetEnabled,
} from "@/lib/dashboard-widgets";
import { assertMinRole } from "@/lib/permissions";

export async function toggleWidgetAction(widgetId: string, enabled: boolean) {
  const user = await requireUser();
  setWidgetEnabled(widgetId, user.id, enabled);
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function reorderWidgetsAction(
  orderedIds: string[],
  scope: "personal" | "project",
  projectId?: string,
) {
  const user = await requireUser();
  if (scope === "project" && projectId) {
    assertMinRole(user, projectId, "viewer");
  }
  reorderWidgets(user.id, orderedIds);
  if (scope === "project" && projectId) {
    revalidatePath(`/projects/${projectId}/dashboard`);
  } else {
    revalidatePath("/dashboard");
  }
  return { ok: true as const };
}
