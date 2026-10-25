import { redirect } from "next/navigation";
import { getSessionUser, isSetupComplete } from "@/lib/auth";
import { isLeadOrAdmin } from "@/lib/permissions";

export default async function HomePage() {
  if (!isSetupComplete()) redirect("/setup");
  const user = await getSessionUser();
  if (!user) redirect("/login");
  redirect(isLeadOrAdmin(user) ? "/dashboard" : "/my-work");
}
