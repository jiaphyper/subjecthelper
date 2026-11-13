import { requireRole } from "@/lib/auth";
import GroupList from "@/components/GroupList";
import Flash from "@/components/Flash";
import { SP } from "@/lib/util";

export default async function Page({ searchParams }: { searchParams: SP }) {
  const me = await requireRole("teacher");
  const sp = await searchParams;
  return (<><h1>组别</h1><Flash ok={sp.ok} err={sp.err} /><GroupList me={me} /></>);
}
