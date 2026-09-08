"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { settingSet } from "@/lib/db";
import { settingSetSecret } from "@/lib/secrets";

export async function updateOidcSettingsAction(formData: FormData) {
  await requireAdmin();
  settingSet("oidc_enabled", formData.get("oidc_enabled") === "on" ? "1" : "0");
  settingSet("oidc_issuer", String(formData.get("oidc_issuer") || "").trim());
  settingSet("oidc_client_id", String(formData.get("oidc_client_id") || "").trim());
  settingSet(
    "oidc_client_secret",
    String(formData.get("oidc_client_secret") || "").trim(),
  );
  settingSet(
    "oidc_redirect_uri",
    String(formData.get("oidc_redirect_uri") || "").trim() ||
      "http://localhost:3000/api/auth/oidc/callback",
  );
  settingSet(
    "oidc_scopes",
    String(formData.get("oidc_scopes") || "").trim() || "openid profile email",
  );
  revalidatePath("/admin/settings");
  revalidatePath("/login");
  return { ok: true as const };
}

export async function updateNotifySettingsAction(formData: FormData) {
  await requireAdmin();
  settingSet(
    "notify_email_enabled",
    formData.get("notify_email_enabled") === "on" ? "1" : "0",
  );
  settingSet("smtp_host", String(formData.get("smtp_host") || "").trim());
  settingSet("smtp_port", String(formData.get("smtp_port") || "587").trim());
  settingSet("smtp_user", String(formData.get("smtp_user") || "").trim());
  const smtpPass = String(formData.get("smtp_pass") || "").trim();
  if (smtpPass && smtpPass !== "••••••••") settingSetSecret("smtp_pass", smtpPass);
  settingSet("smtp_from", String(formData.get("smtp_from") || "").trim());
  settingSet(
    "notify_telegram_enabled",
    formData.get("notify_telegram_enabled") === "on" ? "1" : "0",
  );
  const tg = String(formData.get("telegram_bot_token") || "").trim();
  if (tg && tg !== "••••••••") settingSetSecret("telegram_bot_token", tg);
  settingSet(
    "telegram_default_chat",
    String(formData.get("telegram_default_chat") || "").trim(),
  );
  settingSet(
    "app_base_url",
    String(formData.get("app_base_url") || "").trim() ||
      "http://localhost:3000",
  );
  revalidatePath("/admin/settings");
  return { ok: true as const };
}

export async function updateTelegramChatAction(formData: FormData) {
  const { requireUser } = await import("@/lib/auth");
  const user = await requireUser();
  const chat = String(formData.get("telegram_chat") || "").trim();
  settingSet(`telegram_chat_${user.id}`, chat);
  revalidatePath("/profile");
  return { ok: true as const };
}

export async function sendTestNotificationAction() {
  const user = await requireAdmin();
  const { dispatchExternalNotification } = await import("@/lib/notify-channels");
  await dispatchExternalNotification({
    userId: user.id,
    title: "Тест Dashboard Local",
    body: "Якщо ви бачите це — Email/Telegram канали налаштовані коректно.",
    link: "/dashboard",
  });
  revalidatePath("/admin/settings");
  return { ok: true as const };
}
