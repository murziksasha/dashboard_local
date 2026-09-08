import { describe, expect, it } from "vitest";
import { isMutatingApiCsrfOk } from "../src/lib/csrf";
import { isSafeInlineImage, contentTypeForDownload } from "../src/lib/mime-safe";
import { passwordPolicyError, MIN_PASSWORD_LENGTH } from "../src/lib/password-policy";
import { csvEscape, parseCsv, toCsv } from "../src/lib/csv";
import { assertSqlIdent } from "../src/lib/sql-ident";
import { encryptSecret, decryptSecret } from "../src/lib/secrets";
import { rateLimitHit, rateLimitReset } from "../src/lib/rate-limit";

describe("csrf origin check", () => {
  it("allows GET and bearer tokens", () => {
    const headers = new Headers({ origin: "http://evil.local" });
    expect(
      isMutatingApiCsrfOk({
        method: "GET",
        url: "http://localhost:3000/api/projects",
        headers,
      }),
    ).toBe(true);
    expect(
      isMutatingApiCsrfOk({
        method: "POST",
        url: "http://localhost:3000/api/auth/login",
        headers: new Headers({ authorization: "Bearer abc", origin: "http://evil.local" }),
      }),
    ).toBe(true);
  });

  it("rejects cross-origin cookie POST", () => {
    expect(
      isMutatingApiCsrfOk({
        method: "POST",
        url: "http://localhost:3000/api/push/register",
        headers: new Headers({ origin: "http://evil.lan:4000" }),
      }),
    ).toBe(false);
  });

  it("allows same-origin and missing origin", () => {
    expect(
      isMutatingApiCsrfOk({
        method: "POST",
        url: "http://localhost:3000/api/auth/login",
        headers: new Headers({ origin: "http://localhost:3000" }),
      }),
    ).toBe(true);
    expect(
      isMutatingApiCsrfOk({
        method: "POST",
        url: "http://localhost:3000/api/auth/login",
        headers: new Headers(),
      }),
    ).toBe(true);
  });
});

describe("attachment mime", () => {
  it("never inlines svg or html", () => {
    expect(isSafeInlineImage("image/svg+xml", "x.svg")).toBe(false);
    expect(isSafeInlineImage("text/html", "x.html")).toBe(false);
    expect(isSafeInlineImage("image/png", "x.png")).toBe(true);
    expect(contentTypeForDownload("image/svg+xml", true)).toBe("application/octet-stream");
    expect(contentTypeForDownload("image/png", true)).toBe("image/png");
  });
});

describe("password policy", () => {
  it("rejects short and common passwords", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
    expect(passwordPolicyError("123")).toBeTruthy();
    expect(passwordPolicyError("admin123")).toBeTruthy();
    expect(passwordPolicyError("secret12")).toBeNull();
    expect(passwordPolicyError("adminadmin", "adminadmin")).toBeTruthy();
  });
});

describe("csv injection", () => {
  it("prefixes formula-like cells", () => {
    expect(csvEscape("=cmd")).toBe("'=cmd");
    expect(csvEscape("+1+1")).toBe("'+1+1");
    expect(csvEscape("-1")).toBe("'-1");
    expect(csvEscape("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvEscape("hello, world")).toBe('"hello, world"');
    const parsed = parseCsv('title,type\n"Hello, world",task');
    expect(parsed[1]?.[0]).toBe("Hello, world");
    expect(toCsv(["a"], [{ a: "=1+1" }])).toContain("'=1+1");
  });
});

describe("sql ident", () => {
  it("accepts safe names and rejects injection", () => {
    expect(assertSqlIdent("issues")).toBe("issues");
    expect(() => assertSqlIdent("issues; drop table users")).toThrow();
    expect(() => assertSqlIdent("a b")).toThrow();
  });
});

describe("secrets", () => {
  it("round-trips", () => {
    const enc = encryptSecret("smtp-secret");
    expect(enc.startsWith("enc:v1:")).toBe(true);
    expect(decryptSecret(enc)).toBe("smtp-secret");
    expect(decryptSecret("plain")).toBe("plain");
  });
});

describe("rate limit", () => {
  it("blocks after limit", () => {
    rateLimitReset();
    const a = rateLimitHit("t", 2, 60_000, 1);
    const b = rateLimitHit("t", 2, 60_000, 2);
    const c = rateLimitHit("t", 2, 60_000, 3);
    expect(a.ok && b.ok).toBe(true);
    expect(c.ok).toBe(false);
  });
});
