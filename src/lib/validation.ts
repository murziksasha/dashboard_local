import { z } from "zod";
import { MIN_PASSWORD_LENGTH, passwordPolicyError } from "./password-policy";

export const IssueTypeSchema = z.enum(["epic", "story", "task", "bug", "subtask"]);
export const PrioritySchema = z.enum(["highest", "high", "medium", "low", "lowest"]);
export const LinkTypeSchema = z.enum(["blocks", "relates", "duplicates"]);

export const IdSchema = z.string().min(1).max(80);
export const TitleSchema = z.string().trim().min(1).max(500);
export const LoginSchema = z.string().trim().min(1).max(80);

export const PasswordSchema = z.string().superRefine((val, ctx) => {
  const err = passwordPolicyError(val);
  if (err) ctx.addIssue({ code: "custom", message: err });
});

export function fdString(fd: FormData, key: string): string {
  const v = fd.get(key);
  return v == null ? "" : String(v);
}

export function fdOptional(fd: FormData, key: string): string | undefined {
  if (!fd.has(key)) return undefined;
  return String(fd.get(key) ?? "");
}

export function parseWith<T>(schema: z.ZodType<T>, data: unknown): { ok: true; data: T } | { ok: false; error: string } {
  const res = schema.safeParse(data);
  if (res.success) return { ok: true, data: res.data };
  const first = res.error.issues[0];
  return { ok: false, error: first?.message || "Некоректні дані." };
}

export const CreateIssueInput = z.object({
  projectId: IdSchema,
  title: TitleSchema,
  type: IssueTypeSchema.optional(),
  description: z.string().max(200_000).optional(),
  statusId: z.string().max(80).optional(),
  priority: PrioritySchema.optional(),
  parentId: z.string().max(80).optional(),
  epicId: z.string().max(80).optional(),
  sprintId: z.string().max(80).optional(),
});

export const SetupInput = z.object({
  name: z.string().trim().min(1).max(120),
  login: LoginSchema,
  password: z.string().min(MIN_PASSWORD_LENGTH),
  appName: z.string().trim().max(80).optional(),
});

export const LoginInput = z.object({
  login: LoginSchema,
  password: z.string().min(1).max(200),
});
