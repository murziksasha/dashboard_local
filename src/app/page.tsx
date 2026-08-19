import { redirect } from "next/navigation";
import { getSessionUser, isSetupComplete } from "@/lib/auth";

export default async function HomePage() {
  if (!isSetupComplete()) redirect("/setup");
  const user = await getSessionUser();
  redirect(user ? "/dashboard" : "/login");
}
