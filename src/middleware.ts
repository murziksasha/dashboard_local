import { NextResponse, type NextRequest } from "next/server";
import { isMutatingApiCsrfOk } from "@/lib/csrf";
import { rateLimitHit } from "@/lib/rate-limit";
import { securityHeaders } from "@/lib/security-headers";

function clientKey(req: NextRequest): string {
  const trust =
    process.env.TRUST_PROXY === "1" ||
    (process.env.APP_URL || process.env.APP_BASE_URL || "").startsWith("https");
  if (trust) {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0]!.trim().slice(0, 128) || "local";
    return (req.headers.get("x-real-ip") || "local").slice(0, 128);
  }
  return "local";
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const isHttps =
    url.protocol === "https:" ||
    (process.env.APP_URL || process.env.APP_BASE_URL || "").startsWith("https");

  if (url.pathname.startsWith("/api/")) {
    if (!isMutatingApiCsrfOk({
      method: req.method,
      url: req.url,
      headers: req.headers,
      envUrl: process.env.APP_URL || process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL,
    })) {
      return NextResponse.json({ error: "csrf_rejected" }, { status: 403 });
    }

    const ip = clientKey(req);
    const isLogin = url.pathname === "/api/auth/login";
    const limit = isLogin ? 20 : 240;
    const windowMs = 60_000;
    const hit = rateLimitHit(`${isLogin ? "login" : "api"}:${ip}`, limit, windowMs);
    if (!hit.ok) {
      return NextResponse.json(
        { error: "rate_limited" },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(hit.retryAfterMs / 1000) || 1) },
        },
      );
    }
  }

  const res = NextResponse.next();
  for (const h of securityHeaders(isHttps)) {
    res.headers.set(h.key, h.value);
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js).*)"],
};
