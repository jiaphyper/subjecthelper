import { requireRole } from "@/lib/auth";
import GroupList from "@/components/GroupList";
import Flash from "@/components/Flash";
import { SP } from "@/lib/util";
import { getT } from "@/lib/i18n-server";

export default async function Page({ searchParams }: { searchParams: SP }) {
  const me = await requireRole("admin");
  const sp = await searchParams;
  const t = await getT();
  return (<><h1>{t("组别")}</h1><Flash ok={sp.ok} err={sp.err} /><GroupList me={me} /></>);
}
