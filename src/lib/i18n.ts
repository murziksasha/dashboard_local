export type Locale = "uk" | "en" | "ru";

export const LOCALES: Locale[] = ["uk", "en", "ru"];
export const LOCALE_COOKIE = "dl_locale";

const dict = {
  uk: {
    dashboard: "Дашборд",
    projects: "Проєкти",
    teams: "Команди",
    settings: "Налаштування",
    users: "Користувачі",
    backups: "Бекапи",
    audit: "Аудит",
    welcome: "Вітаємо,",
    search: "Пошук",
    newIssue: "Нова задача",
    save: "Зберегти",
    cancel: "Скасувати",
    login: "Вхід",
    password: "Пароль",
    signIn: "Увійти",
    issueCreated: "Задачу створено",
    commentAdded: "Коментар додано",
    saved: "Збережено",
    deleted: "Видалено",
    language: "Мова",
    health: "Стан системи",
    webhooks: "Вебхуки",
    templates: "Шаблони",
    importCsv: "Імпорт CSV",
    timeTracking: "Облік часу",
  },
  en: {
    dashboard: "Dashboard",
    projects: "Projects",
    teams: "Teams",
    settings: "Settings",
    users: "Users",
    backups: "Backups",
    audit: "Audit",
    welcome: "Welcome,",
    search: "Search",
    newIssue: "New issue",
    save: "Save",
    cancel: "Cancel",
    login: "Sign in",
    password: "Password",
    signIn: "Sign in",
    issueCreated: "Issue created",
    commentAdded: "Comment added",
    saved: "Saved",
    deleted: "Deleted",
    language: "Language",
    health: "Health",
    webhooks: "Webhooks",
    templates: "Templates",
    importCsv: "Import CSV",
    timeTracking: "Time tracking",
  },
  ru: {
    dashboard: "Дашборд",
    projects: "Проекты",
    teams: "Команды",
    settings: "Настройки",
    users: "Пользователи",
    backups: "Бэкапы",
    audit: "Аудит",
    welcome: "Здравствуйте,",
    search: "Поиск",
    newIssue: "Новая задача",
    save: "Сохранить",
    cancel: "Отмена",
    login: "Вход",
    password: "Пароль",
    signIn: "Войти",
    issueCreated: "Задача создана",
    commentAdded: "Комментарий добавлен",
    saved: "Сохранено",
    deleted: "Удалено",
    language: "Язык",
    health: "Состояние",
    webhooks: "Вебхуки",
    templates: "Шаблоны",
    importCsv: "Импорт CSV",
    timeTracking: "Учёт времени",
  },
} as const;

export type MessageKey = keyof typeof dict.uk;

export function isLocale(v: string | undefined | null): v is Locale {
  return v === "uk" || v === "en" || v === "ru";
}

export function t(locale: Locale, key: MessageKey): string {
  return dict[locale][key] || dict.uk[key];
}

export function messages(locale: Locale) {
  return dict[locale];
}
