import { requireRole } from "@/lib/auth";
import TaskTable from "@/components/TaskTable";
import TeacherChecklist from "@/components/TeacherChecklist";
import Flash from "@/components/Flash";
import { SP } from "@/lib/util";
import { getT } from "@/lib/i18n-server";

export default async function TeacherHome({ searchParams }: { searchParams: SP }) {
  const me = await requireRole("teacher");
  const sp = await searchParams;
  const t = await getT();
  return (
    <>
      <div className="topbar"><h1>{t("我的任务")}</h1><a className="btn" href="/teacher/tasks/new" data-tour="new-task">{t("＋ 布置任务")}</a></div>
      <Flash ok={sp.ok} err={sp.err} />
      <TeacherChecklist me={me} />
      <TaskTable teacherId={me.id} base="/teacher/tasks" path="/teacher" sp={sp} />
    </>
  );
}
