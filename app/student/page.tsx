import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export default async function StudentHome() {
  const me = await requireRole("student");
  const tasks = db
    .prepare(
      `SELECT t.id, t.title, t.max_attempts, t.due_at, t.config_json, t.created_at, s.name subject, u.name teacher,
         (SELECT COUNT(*) FROM attempts a WHERE a.task_id=t.id AND a.student_id=?) used,
         (SELECT COUNT(*) FROM attempts a WHERE a.task_id=t.id AND a.student_id=? AND a.status='in_progress') open,
         (SELECT MAX(a.score*1.0/MAX(a.total,1)) FROM attempts a WHERE a.task_id=t.id AND a.student_id=?) best
       FROM task_students ts JOIN tasks t ON t.id=ts.task_id JOIN subjects s ON s.id=t.subject_id JOIN users u ON u.id=t.teacher_id
       WHERE ts.student_id=? ORDER BY (used=0) DESC, t.id DESC`
    )
    .all(me.id, me.id, me.id, me.id) as any[];
  const todo = tasks.filter((t) => t.used === 0);
  return (
    <>
      <h1>我的任务</h1>
      {tasks.length > 0 && <p className="muted">{todo.length ? `有 ${todo.length} 个任务还没做` : "所有任务都做过啦 🎉"}</p>}
      <div className="stack">
        {tasks.map((t) => {
          const c = JSON.parse(t.config_json);
          const types = [c.mcq && "选择题", c.match && "连线题", c.cloze && "填空题"].filter(Boolean);
          const overdue = t.due_at && new Date(t.due_at) < new Date();
          const best = t.best == null ? null : Math.round(t.best * 100);
          const canDo = (t.open > 0 || t.used < t.max_attempts) && !overdue;
          return (
            <a key={t.id} href={`/student/tasks/${t.id}`} className="card row" style={{ color: "inherit", textDecoration: "none", marginBottom: 0 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 600 }}>{t.title}</div>
                <div className="small muted">{t.subject} · {t.teacher} · {types.join(" / ")}{t.due_at ? ` · 截止 ${t.due_at.replace("T", " ")}` : ""}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                {best !== null ? <div className={"badge " + (best >= 80 ? "ok" : best >= 60 ? "warn" : "bad")} style={{ fontSize: 15 }}>最高 {best}%</div> : <span className="badge warn">未完成</span>}
                <div className="small muted" style={{ marginTop: 4 }}>
                  已做 {t.used}/{t.max_attempts} 次{overdue ? " · 已截止" : ""}
                </div>
              </div>
              <span className={"btn " + (canDo ? "" : "btn-ghost")}>{canDo ? (t.open ? "继续" : t.used ? "再做一次" : "开始") : "查看"}</span>
            </a>
          );
        })}
        {!tasks.length && <div className="card muted">老师还没有布置任务</div>}
      </div>
    </>
  );
}
