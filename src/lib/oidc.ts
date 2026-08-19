import * as oidc from "openid-client";
import { settingGet } from "./db";

export type OidcConfig = {
  enabled: boolean;
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string;
};

export function getOidcConfig(): OidcConfig {
  return {
    enabled: settingGet("oidc_enabled") === "1",
    issuer: settingGet("oidc_issuer") || "",
    clientId: settingGet("oidc_client_id") || "",
    clientSecret: settingGet("oidc_client_secret") || "",
    redirectUri:
      settingGet("oidc_redirect_uri") ||
      "http://localhost:3000/api/auth/oidc/callback",
    scopes: settingGet("oidc_scopes") || "openid profile email",
  };
}

export function isOidcEnabled() {
  const c = getOidcConfig();
  return c.enabled && !!c.issuer && !!c.clientId && !!c.clientSecret;
}

export async function getOidcConfiguration() {
  const c = getOidcConfig();
  if (!c.issuer || !c.clientId) throw new Error("OIDC_NOT_CONFIGURED");
  const url = new URL(c.issuer);
  // allow http:// issuers for local Keycloak etc.
  if (url.protocol === "http:") {
    return oidc.discovery(url, c.clientId, c.clientSecret, undefined, {
      execute: [oidc.allowInsecureRequests],
    });
  }
  return oidc.discovery(url, c.clientId, c.clientSecret);
}

export async function buildOidcAuthUrl(state: string, codeVerifier: string) {
  const c = getOidcConfig();
  const config = await getOidcConfiguration();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
  return oidc.buildAuthorizationUrl(config, {
    redirect_uri: c.redirectUri,
    scope: c.scopes,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
  });
}

export async function exchangeOidcCode(params: {
  callbackUrl: URL;
  codeVerifier: string;
  expectedState: string;
}) {
  const config = await getOidcConfiguration();
  const tokens = await oidc.authorizationCodeGrant(config, params.callbackUrl, {
    pkceCodeVerifier: params.codeVerifier,
    expectedState: params.expectedState,
  });
  const claims = tokens.claims();
  let profile = {
    sub: String(claims?.sub || ""),
    email: (claims?.email as string | undefined) || null,
    name:
      (claims?.name as string | undefined) ||
      (claims?.preferred_username as string | undefined) ||
      (claims?.email as string | undefined) ||
      "SSO User",
    login:
      (claims?.preferred_username as string | undefined) ||
      (claims?.email as string | undefined)?.split("@")[0] ||
      String(claims?.sub || "sso"),
  };

  if ((!profile.email || !claims?.name) && tokens.access_token) {
    try {
      const info = await oidc.fetchUserInfo(
        config,
        tokens.access_token,
        oidc.skipSubjectCheck,
      );
      profile = {
        sub: profile.sub || String(info.sub || ""),
        email: (info.email as string | undefined) || profile.email,
        name:
          (info.name as string | undefined) ||
          (info.preferred_username as string | undefined) ||
          profile.name,
        login:
          (info.preferred_username as string | undefined) ||
          (info.email as string | undefined)?.split("@")[0] ||
          profile.login,
      };
    } catch {
      // optional userinfo
    }
  }

  return profile;
}
