import { Client } from "ldapts";
import { settingGet } from "./db";

export type LdapConfig = {
  enabled: boolean;
  url: string;
  bindDnTemplate: string;
  baseDn: string;
  searchFilter: string;
};

export function getLdapConfig(): LdapConfig {
  return {
    enabled: settingGet("ldap_enabled") === "1",
    url: settingGet("ldap_url") || "",
    bindDnTemplate:
      settingGet("ldap_bind_dn_template") || "uid={username},ou=people,{baseDn}",
    baseDn: settingGet("ldap_base_dn") || "",
    searchFilter:
      settingGet("ldap_search_filter") || "(uid={username})",
  };
}

export function isLdapEnabled() {
  const cfg = getLdapConfig();
  return cfg.enabled && !!cfg.url && !!cfg.baseDn;
}

function fillTemplate(tpl: string, username: string, baseDn: string) {
  return tpl
    .replaceAll("{username}", username)
    .replaceAll("{baseDn}", baseDn);
}

/**
 * Attempt LDAP bind. Returns profile fields on success, null on failure.
 * Does not throw for invalid credentials.
 */
export async function ldapAuthenticate(
  username: string,
  password: string,
): Promise<{ login: string; name: string; email: string | null } | null> {
  const cfg = getLdapConfig();
  if (!cfg.enabled || !cfg.url || !password) return null;

  const bindDn = fillTemplate(cfg.bindDnTemplate, username, cfg.baseDn);
  const client = new Client({ url: cfg.url, timeout: 8000, connectTimeout: 8000 });

  try {
    await client.bind(bindDn, password);

    let name = username;
    let email: string | null = null;
    try {
      const filter = fillTemplate(cfg.searchFilter, username, cfg.baseDn);
      const { searchEntries } = await client.search(cfg.baseDn, {
        scope: "sub",
        filter,
        attributes: ["cn", "displayName", "mail", "uid", "sAMAccountName"],
        sizeLimit: 1,
      });
      const entry = searchEntries[0] as Record<string, unknown> | undefined;
      if (entry) {
        const cn = entry.cn || entry.displayName;
        if (typeof cn === "string") name = cn;
        else if (Array.isArray(cn) && typeof cn[0] === "string") name = cn[0];
        const mail = entry.mail;
        if (typeof mail === "string") email = mail;
        else if (Array.isArray(mail) && typeof mail[0] === "string") email = mail[0];
      }
    } catch {
      // bind succeeded; search is optional
    }

    return { login: username, name, email };
  } catch {
    return null;
  } finally {
    try {
      await client.unbind();
    } catch {
      // ignore
    }
  }
}
