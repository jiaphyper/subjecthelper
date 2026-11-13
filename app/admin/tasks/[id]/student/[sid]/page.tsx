import { requireRole } from "@/lib/auth";
import AttemptPage from "@/components/AttemptPage";
import { SP } from "@/lib/util";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string; sid: string }>; searchParams: SP }) {
  const me = await requireRole("admin");
  const { id, sid } = await params;
  const sp = await searchParams;
  return <AttemptPage me={me} taskId={Number(id)} studentId={Number(sid)} n={sp.n ? Number(sp.n) : undefined} />;
}
