import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

const isHttps = (process.env.APP_URL || process.env.APP_BASE_URL || "").startsWith("https");

const nextConfig: NextConfig = {
  serverExternalPackages: ["node:sqlite", "nodemailer", "ldapts", "openid-client"],
  experimental: {
    serverActions: {
      bodySizeLimit: "30mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders(isHttps),
      },
    ];
  },
};

export default nextConfig;
