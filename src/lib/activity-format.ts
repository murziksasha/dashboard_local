export function formatActivity(
  action: string,
  actorName: string | null,
  payloadJson?: string | null,
  issueKey?: string | null,
): string {
  const who = actorName || "Система";
  let payload: Record<string, unknown> = {};
  try {
    payload = payloadJson ? (JSON.parse(payloadJson) as Record<string, unknown>) : {};
  } catch {
    payload = {};
  }
  const key = issueKey || (typeof payload.key === "string" ? payload.key : "");
  switch (action) {
    case "issue.created":
      return `${who} створив(ла) ${key || "задачу"}`;
    case "issue.updated":
      return `${who} оновив(ла) ${key || "задачу"}`;
    case "issue.moved":
      return `${who} змінив(ла) статус ${key || "задачі"}`;
    case "issue.deleted":
      return `${who} видалив(ла) ${key || "задачу"}`;
    case "comment.added":
      return `${who} прокоментував(ла) ${key || "задачу"}`;
    case "comment.updated":
      return `${who} змінив(ла) коментар`;
    case "comment.deleted":
      return `${who} видалив(ла) коментар`;
    case "attachment.added":
      return `${who} додав(ла) файл`;
    case "worklog.added":
      return `${who} залоговав(ла) час`;
    case "issue.linked":
      return `${who} додав(ла) звʼязок`;
    case "project.created":
      return `${who} створив(ла) проєкт`;
    default:
      return `${who}: ${action}`;
  }
}
