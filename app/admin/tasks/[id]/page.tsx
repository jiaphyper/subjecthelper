import { requireRole } from "@/lib/auth";
import TaskResults from "@/components/TaskResults";
import Flash from "@/components/Flash";
import { SP } from "@/lib/util";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const me = await requireRole("admin");
  const sp = await searchParams;
  return (<><Flash ok={sp.ok} err={sp.err} /><TaskResults me={me} id={Number((await params).id)} /></>);
}
