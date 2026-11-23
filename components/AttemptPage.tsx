import { notFound } from "next/navigation";
import { db, User } from "@/lib/db";
import AttemptReview from "./AttemptReview";
import { pct } from "@/lib/tasks";
import { getT } from "@/lib/i18n-server";

export default async function AttemptPage({ me, taskId, studentId, n }: { me: User; taskId: number; studentId: number; n?: number }) {
  const t = await getT();
  const task = db.prepare("SELECT * FROM tasks WHERE id=?").get(taskId) as any;
  if (!task || (me.role === "teacher" && task.teacher_id !== me.id)) notFound();
  const stu = db.prepare("SELECT name, username FROM users WHERE id=?").get(studentId) as any;
  const all = db.prepare("SELECT * FROM attempts WHERE task_id=? AND student_id=? ORDER BY attempt_no").all(taskId, studentId) as any[];
  const a = all.find((x) => x.attempt_no === n) ?? all[all.length - 1];
  const base = me.role === "admin" ? "/admin/tasks" : "/teacher/tasks";
  return (
    <>
      <div className="topbar">
        <h1>{stu?.name} · {task.title}</h1>
        <a className="btn btn-ghost" href={`${base}/${taskId}`}>{t("← 返回成绩")}</a>
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        {all.map((x) => (
          <a key={x.id} href={`?n=${x.attempt_no}`} className={"btn btn-sm " + (x.id === a?.id ? "" : "btn-ghost")}>
            {t(`第 ${x.attempt_no} 次：${x.score}/${x.total}（${pct(x.score, x.total)}%）`)}{x.status === "in_progress" ? ` · ${t("进行中")}` : ""}
          </a>
        ))}
      </div>
      {a ? (
        <>
          <p className="muted small">{a.status === "in_progress" ? t(`进行中（开始于 ${a.started_at}），以下为目前已校验的部分`) : t(`提交时间：${a.submitted_at}`)}</p>
          <AttemptReview content={JSON.parse(task.content_json)} result={JSON.parse(a.result_json)} answers={JSON.parse(a.answers_json)} />
        </>
      ) : <div className="card muted">{t("该学生还没有提交")}</div>}
    </>
  );
}
