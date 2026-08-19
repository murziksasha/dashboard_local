import { all, get, run } from "./db";
import { createId } from "./id";
import {
  PERSONAL_WIDGETS,
  PROJECT_WIDGETS,
  widgetTitle,
} from "./dashboard-widget-meta";

export { PERSONAL_WIDGETS, PROJECT_WIDGETS, widgetTitle };

export type WidgetRow = {
  id: string;
  owner_id: string;
  scope: "personal" | "project";
  project_id: string | null;
  widget_type: string;
  position: number;
  enabled: number;
  config_json: string | null;
};

export function ensurePersonalWidgets(userId: string) {
  const existing = all<WidgetRow>(
    `SELECT * FROM dashboard_widgets WHERE owner_id = ? AND scope = 'personal'`,
    [userId],
  );
  if (existing.length) return existing.sort((a, b) => a.position - b.position);

  PERSONAL_WIDGETS.forEach((w, i) => {
    run(
      `INSERT INTO dashboard_widgets (id, owner_id, scope, project_id, widget_type, position, enabled, config_json)
       VALUES (?, ?, 'personal', NULL, ?, ?, 1, NULL)`,
      [createId("wdg"), userId, w.type, i],
    );
  });
  return all<WidgetRow>(
    `SELECT * FROM dashboard_widgets WHERE owner_id = ? AND scope = 'personal' ORDER BY position`,
    [userId],
  );
}

export function ensureProjectWidgets(userId: string, projectId: string) {
  const existing = all<WidgetRow>(
    `SELECT * FROM dashboard_widgets WHERE owner_id = ? AND scope = 'project' AND project_id = ?`,
    [userId, projectId],
  );
  if (existing.length) return existing.sort((a, b) => a.position - b.position);

  PROJECT_WIDGETS.forEach((w, i) => {
    run(
      `INSERT INTO dashboard_widgets (id, owner_id, scope, project_id, widget_type, position, enabled, config_json)
       VALUES (?, ?, 'project', ?, ?, ?, 1, NULL)`,
      [createId("wdg"), userId, projectId, w.type, i],
    );
  });
  return all<WidgetRow>(
    `SELECT * FROM dashboard_widgets WHERE owner_id = ? AND scope = 'project' AND project_id = ? ORDER BY position`,
    [userId, projectId],
  );
}

export function setWidgetEnabled(widgetId: string, ownerId: string, enabled: boolean) {
  run(
    `UPDATE dashboard_widgets SET enabled = ? WHERE id = ? AND owner_id = ?`,
    [enabled ? 1 : 0, widgetId, ownerId],
  );
}

export function reorderWidgets(ownerId: string, orderedIds: string[]) {
  orderedIds.forEach((id, position) => {
    run(
      `UPDATE dashboard_widgets SET position = ? WHERE id = ? AND owner_id = ?`,
      [position, id, ownerId],
    );
  });
}

export function getWidget(id: string) {
  return get<WidgetRow>(`SELECT * FROM dashboard_widgets WHERE id = ?`, [id]);
}
