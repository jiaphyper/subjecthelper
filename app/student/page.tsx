import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { isOverdue } from "@/lib/studentTask";

export default async function StudentHome() {
  const me = await requireRole("student");
  const t = await getT();
  const tasks = db
    .prepare(
      `SELECT t.id, t.title, t.max_attempts, t.due_at, t.config_json, t.created_at, s.name subject, u.name teacher,
         (SELECT COUNT(*) FROM attempts a WHERE a.task_id=t.id AND a.student_id=?) used,
         (SELECT COUNT(*) FROM attempts a WHERE a.task_id=t.id AND a.student_id=? AND a.status='in_progress') open,
         (SELECT MAX(a.score*1.0/MAX(a.total,1)) FROM attempts a WHERE a.task_id=t.id AND a.student_id=? AND a.status='submitted') best
       FROM task_students ts JOIN tasks t ON t.id=ts.task_id JOIN subjects s ON s.id=t.subject_id JOIN users u ON u.id=t.teacher_id
       WHERE ts.student_id=? AND t.kind='task'
       ORDER BY (best IS NULL) DESC, (t.due_at IS NULL), t.due_at, t.id DESC`
    )
    .all(me.id, me.id, me.id, me.id) as any[];
  const todo = tasks.filter((x) => x.best === null && !isOverdue(x.due_at));
  return (
    <>
      <h1>{t("我的任务")}</h1>
      {tasks.length > 0 && <p className="muted">{todo.length ? t(`有 ${todo.length} 个任务还没完成`) : t("所有任务都做过啦 🎉")}</p>}
      <div className="stack">
        {tasks.map((x) => {
          const c = JSON.parse(x.config_json);
          const types = [c.mcq && t("选择题"), c.match && t("连线题"), c.cloze && t("填空题")].filter(Boolean);
          const overdue = isOverdue(x.due_at);
          const soon = !overdue && x.due_at && new Date(x.due_at).getTime() - Date.now() < 48 * 3600_000;
          const best = x.best == null ? null : Math.round(x.best * 100);
          const canDo = (x.open > 0 || x.used < x.max_attempts) && !overdue;
          return (
            <a key={x.id} href={`/student/tasks/${x.id}`} className="card row task-card">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="task-title">{x.title}</div>
                <div className="small muted">
                  {x.subject} · {x.teacher} · {types.join(" / ")}
                  {x.due_at ? <span className={soon ? "due-soon" : ""}> · {t(`截止 ${x.due_at.replace("T", " ")}`)}</span> : ""}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                {best !== null ? <div className={"badge " + (best >= 80 ? "ok" : best >= 60 ? "warn" : "bad")} style={{ fontSize: 15 }}>{t(`最高 ${best}%`)}</div>
                  : x.open ? <span className="badge warn">{t("进行中")}</span> : <span className="badge warn">{t("未完成")}</span>}
                <div className="small muted" style={{ marginTop: 4 }}>
                  {t(`已做 ${x.used}/${x.max_attempts} 次`)}{overdue ? ` · ${t("已截止")}` : ""}
                </div>
              </div>
              <span className={"btn " + (canDo ? "" : "btn-ghost")}>{canDo ? (x.open ? t("继续") : x.used ? t("再做一次") : t("开始")) : t("查看")}</span>
            </a>
          );
        })}
        {!tasks.length && <div className="card muted">{t("老师还没有布置任务")}</div>}
      </div>
    </>
  );
}
