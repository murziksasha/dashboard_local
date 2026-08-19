import nodemailer from "nodemailer";
import { get, settingGet } from "./db";
import { listPushTokens, sendExpoPush } from "./push";

export function getNotifyChannelConfig() {
  return {
    emailEnabled: settingGet("notify_email_enabled") === "1",
    smtpHost: settingGet("smtp_host") || "",
    smtpPort: Number(settingGet("smtp_port") || "587"),
    smtpUser: settingGet("smtp_user") || "",
    smtpPass: settingGet("smtp_pass") || "",
    smtpFrom: settingGet("smtp_from") || "dashboard@local",
    telegramEnabled: settingGet("notify_telegram_enabled") === "1",
    telegramBotToken: settingGet("telegram_bot_token") || "",
    // optional global chat; per-user chat id in settings key telegram_chat_<userId>
    telegramDefaultChat: settingGet("telegram_default_chat") || "",
    appBaseUrl: settingGet("app_base_url") || "http://localhost:3000",
  };
}

async function sendEmail(to: string, subject: string, text: string) {
  const cfg = getNotifyChannelConfig();
  if (!cfg.emailEnabled || !cfg.smtpHost || !to) return;
  const transporter = nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    secure: cfg.smtpPort === 465,
    auth:
      cfg.smtpUser
        ? { user: cfg.smtpUser, pass: cfg.smtpPass }
        : undefined,
  });
  await transporter.sendMail({
    from: cfg.smtpFrom,
    to,
    subject,
    text,
  });
}

async function sendTelegram(chatId: string, text: string) {
  const cfg = getNotifyChannelConfig();
  if (!cfg.telegramEnabled || !cfg.telegramBotToken || !chatId) return;
  const url = `https://api.telegram.org/bot${cfg.telegramBotToken}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });
}

export async function dispatchExternalNotification(params: {
  userId: string;
  title: string;
  body?: string;
  link?: string;
}) {
  const cfg = getNotifyChannelConfig();
  const user = get<{ email: string | null; name: string }>(
    `SELECT email, name FROM users WHERE id = ?`,
    [params.userId],
  );
  const link = params.link
    ? `${cfg.appBaseUrl.replace(/\/$/, "")}${params.link}`
    : "";
  const text = [params.title, params.body, link].filter(Boolean).join("\n");

  try {
    if (user?.email) await sendEmail(user.email, params.title, text);
  } catch {
    // non-fatal
  }

  try {
    const chat =
      settingGet(`telegram_chat_${params.userId}`) || cfg.telegramDefaultChat;
    if (chat) await sendTelegram(chat, text);
  } catch {
    // non-fatal
  }

  try {
    const tokens = listPushTokens(params.userId);
    if (tokens.length) {
      await sendExpoPush({
        tokens,
        title: params.title,
        body: params.body,
        data: params.link ? { link: params.link } : {},
      });
    }
  } catch {
    // non-fatal
  }
}
