const COMMON = new Set(
  [
    "password",
    "password1",
    "password12",
    "12345678",
    "123456789",
    "qwerty",
    "qwerty123",
    "admin123",
    "admin1234",
    "letmein",
    "welcome",
    "welcome1",
    "iloveyou",
    "monkey",
    "dragon",
    "baseball",
    "football",
    "abc12345",
    "11111111",
    "00000000",
    "passw0rd",
    "changeme",
    "dashboard",
    "dashboard1",
  ].map((s) => s.toLowerCase()),
);

export const MIN_PASSWORD_LENGTH = 8;

export function passwordPolicyError(password: string, login?: string): string | null {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return `Пароль має містити щонайменше ${MIN_PASSWORD_LENGTH} символів.`;
  }
  if (/\s/.test(password)) {
    return "Пароль не може містити пробіли.";
  }
  const lower = password.toLowerCase();
  if (COMMON.has(lower)) {
    return "Цей пароль занадто поширений.";
  }
  if (login && lower === login.trim().toLowerCase()) {
    return "Пароль не може збігатися з логіном.";
  }
  return null;
}
