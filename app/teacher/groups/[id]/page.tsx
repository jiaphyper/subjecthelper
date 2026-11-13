import { requireRole } from "@/lib/auth";
import GroupEditor from "@/components/GroupEditor";
import Flash from "@/components/Flash";
import { SP } from "@/lib/util";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const me = await requireRole("teacher");
  const sp = await searchParams;
  const { id } = await params;
  return (<><Flash ok={sp.ok} err={sp.err} /><GroupEditor me={me} id={Number(id)} sp={sp} /></>);
}
