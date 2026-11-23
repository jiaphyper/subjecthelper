import { requireRole } from "@/lib/auth";
import { SP } from "@/lib/util";
import Flash from "@/components/Flash";
import PracticeAdmin from "@/components/PracticeAdmin";

export default async function Page({ searchParams }: { searchParams: SP }) {
  const me = await requireRole("teacher");
  const sp = await searchParams;
  return (<><Flash ok={sp.ok} err={sp.err} /><PracticeAdmin me={me} /></>);
}
