export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(
  base: string,
  path: string,
  opts: { token?: string | null; method?: string; json?: unknown; form?: FormData } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.json !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${base}${path}`, {
    method: opts.method || (opts.json || opts.form ? "POST" : "GET"),
    headers,
    body: opts.form ? opts.form : opts.json !== undefined ? JSON.stringify(opts.json) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiError(res.status, data.error || `http_${res.status}`);
  return data;
}
