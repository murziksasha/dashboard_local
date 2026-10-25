import { requireUser } from "@/lib/auth";
import { listMyWork } from "@/lib/my-work";
import { MyWorkClient } from "@/components/my-work/my-work-client";

export default async function MyWorkPage() {
  const user = await requireUser();
  const data = listMyWork(user);

  return <MyWorkClient initialData={data} />;
}
