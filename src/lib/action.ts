import { log } from "./logger";

export type ActionOk<T extends Record<string, unknown> = Record<string, never>> = { ok: true } & T;
export type ActionErr = { error: string };
export type ActionResult<T extends Record<string, unknown> = Record<string, never>> = ActionOk<T> | ActionErr;

export async function withAction<T extends Record<string, unknown>>(
  name: string,
  fn: () => Promise<ActionResult<T>> | ActionResult<T>,
): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "UNAUTHORIZED") return { error: "Потрібен вхід." };
    if (msg === "FORBIDDEN") return { error: "Немає прав." };
    log.caught(`action.${name}`, e);
    return { error: msg.startsWith("Ліміт WIP") ? msg : "Не вдалося виконати дію." };
  }
}
