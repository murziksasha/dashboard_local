import { log } from "./logger";

export type ActionOk<T extends Record<string, unknown> = Record<string, never>> = { ok: true } & T;
export type ActionErr = { error: string };
export type ActionResult<T extends Record<string, unknown> = Record<string, never>> = ActionOk<T> | ActionErr;

export async function withAction<T>(
  name: string,
  fn: () => Promise<T> | T,
): Promise<T | ActionErr> {
  try {
    return await fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "UNAUTHORIZED") return { error: "Потрібен вхід." };
    if (msg === "FORBIDDEN") return { error: "Немає прав." };
    if (msg === "NOT_FOUND") return { error: "Не знайдено." };
    if (msg === "PROJECT_NOT_FOUND") return { error: "Проєкт не знайдено." };
    const safePrefixes = [
      "Ліміт WIP",
      "Workflow «",
      "Уже є активний спринт",
      "Неможливо видалити статус",
      "Має залишитись хоча б один статус",
      "Назва ",
      "Заголовок ",
      "Ключ:",
      "Пароль",
    ];
    if (safePrefixes.some((p) => msg.startsWith(p))) {
      return { error: msg };
    }
    log.caught(`action.${name}`, e);
    return { error: "Не вдалося виконати дію." };
  }
}
