"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { settingSet } from "@/lib/db";

export async function updateLdapSettingsAction(formData: FormData) {
  await requireAdmin();
  const enabled = formData.get("ldap_enabled") === "on" ? "1" : "0";
  settingSet("ldap_enabled", enabled);
  settingSet("ldap_url", String(formData.get("ldap_url") || "").trim());
  settingSet(
    "ldap_base_dn",
    String(formData.get("ldap_base_dn") || "").trim(),
  );
  settingSet(
    "ldap_bind_dn_template",
    String(formData.get("ldap_bind_dn_template") || "").trim() ||
      "uid={username},ou=people,{baseDn}",
  );
  settingSet(
    "ldap_search_filter",
    String(formData.get("ldap_search_filter") || "").trim() ||
      "(uid={username})",
  );
  revalidatePath("/admin/settings");
  return { ok: true as const };
}
