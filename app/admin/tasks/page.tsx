import TaskTable from "@/components/TaskTable";
import Flash from "@/components/Flash";
import { SP } from "@/lib/util";

export default async function Page({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return (<><h1>全部任务</h1><Flash ok={sp.ok} err={sp.err} /><TaskTable base="/admin/tasks" /></>);
}
