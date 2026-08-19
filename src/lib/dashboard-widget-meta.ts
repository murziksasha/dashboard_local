export const PERSONAL_WIDGETS = [
  { type: "assigned", title: "Призначено мені" },
  { type: "overdue", title: "Прострочені" },
  { type: "projects", title: "Мої проєкти" },
  { type: "recent", title: "Нещодавно оновлені" },
  { type: "notifications", title: "Непрочитані сповіщення" },
] as const;

export const PROJECT_WIDGETS = [
  { type: "by_status", title: "По статусах" },
  { type: "sprint", title: "Активний спринт" },
  { type: "created_done", title: "Створено / Done" },
  { type: "activity", title: "Стрічка активності" },
  { type: "totals", title: "Підсумки" },
] as const;

export function widgetTitle(type: string, scope: "personal" | "project") {
  const list = scope === "personal" ? PERSONAL_WIDGETS : PROJECT_WIDGETS;
  return list.find((w) => w.type === type)?.title || type;
}
