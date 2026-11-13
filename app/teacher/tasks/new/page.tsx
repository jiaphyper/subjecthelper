import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { SP } from "@/lib/util";
import Flash from "@/components/Flash";
import TaskForm from "./TaskForm";
import { createTask } from "../actions";

export default async function NewTaskPage({ searchParams }: { searchParams: SP }) {
  const me = await requireRole("teacher");
  const sp = await searchParams;
  if (!me.org_id) return (<><h1>布置任务</h1><div className="flash bad">你的账号还没有分配学校，请联系管理员。</div></>);
  const subjects = (db.prepare("SELECT id, name FROM subjects ORDER BY name").all() as any[]).map((s) => ({
    ...s,
    mcqTags: db.prepare("SELECT COALESCE(tag,'') tag, COUNT(*) n FROM mcq_questions WHERE subject_id=? GROUP BY tag ORDER BY tag").all(s.id),
    vocabTags: db.prepare(
      "SELECT COALESCE(tag,'') tag, SUM(chinese IS NOT NULL AND chinese<>'') cn, SUM(definition IS NOT NULL AND definition<>'') def FROM vocab WHERE subject_id=? GROUP BY tag ORDER BY tag"
    ).all(s.id),
    clozeSets: db.prepare("SELECT s.id, s.title, s.tag, (SELECT COUNT(*) FROM cloze_items i WHERE i.set_id=s.id) n FROM cloze_sets s WHERE subject_id=? ORDER BY s.id DESC").all(s.id),
  }));
  const groups = db
    .prepare(
      `SELECT g.id, g.name, g.teacher_id, t.name teacher,
        (SELECT COUNT(*) FROM group_members m WHERE m.group_id=g.id) n,
        (SELECT COUNT(*) FROM group_members m JOIN teacher_students ts ON ts.student_id=m.student_id AND ts.teacher_id=? WHERE m.group_id=g.id) mine
       FROM groups g LEFT JOIN users t ON t.id=g.teacher_id WHERE g.teacher_id=? ORDER BY g.name`
    )
    .all(me.id, me.id) as any[];
  return (
    <>
      <h1>布置任务</h1>
      <Flash ok={sp.ok} err={sp.err} />
      {!subjects.length ? <div className="card">管理员还没有添加学科和题目。</div> : <TaskForm subjects={subjects} groups={groups} meId={me.id} action={createTask} />}
    </>
  );
}
