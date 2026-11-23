import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { SP } from "@/lib/util";
import { getT } from "@/lib/i18n-server";
import { loadSubjectOptions } from "@/lib/subjectOptions";
import Flash from "@/components/Flash";
import TaskForm from "./TaskForm";
import { createTask } from "../actions";

export default async function NewTaskPage({ searchParams }: { searchParams: SP }) {
  const me = await requireRole("teacher");
  const t = await getT();
  const sp = await searchParams;
  if (!me.org_id) return (<><h1>{t("布置任务")}</h1><div className="flash bad">{t("你的账号还没有分配学校，请联系管理员。")}</div></>);
  const subjects = loadSubjectOptions();
  const groups = (db.prepare("SELECT g.id, g.name FROM groups g WHERE g.teacher_id=? ORDER BY g.name").all(me.id) as any[]).map((g) => ({
    ...g,
    members: (db.prepare("SELECT student_id FROM group_members WHERE group_id=?").all(g.id) as any[]).map((r) => r.student_id),
    mine: (db
      .prepare("SELECT m.student_id FROM group_members m JOIN teacher_students ts ON ts.student_id=m.student_id AND ts.teacher_id=? WHERE m.group_id=?")
      .all(me.id, g.id) as any[]).map((r) => r.student_id),
  }));
  return (
    <>
      <h1>{t("布置任务")}</h1>
      <Flash ok={sp.ok} err={sp.err} />
      {!subjects.length ? <div className="card">{t("管理员还没有添加学科和题目。")}</div> : <TaskForm subjects={subjects} groups={groups} action={createTask} />}
    </>
  );
}
