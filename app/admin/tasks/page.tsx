import TaskTable from "@/components/TaskTable";
import Flash from "@/components/Flash";
import { SP } from "@/lib/util";
import { getT } from "@/lib/i18n-server";

export default async function Page({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const t = await getT();
  return (<><h1>{t("全部任务")}</h1><Flash ok={sp.ok} err={sp.err} /><TaskTable base="/admin/tasks" path="/admin/tasks" sp={sp} /></>);
}
