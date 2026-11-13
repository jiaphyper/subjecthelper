import { notFound } from "next/navigation";
import { db, User } from "@/lib/db";
import { countItems, TaskContent } from "@/lib/tasks";
import { taskResults } from "@/lib/results";
import { deleteTask } from "@/app/teacher/tasks/actions";
import ConfirmButton from "./ConfirmButton";

export default function TaskResults({ me, id }: { me: User; id: number }) {
  const base = me.role === "admin" ? "/admin/tasks" : "/teacher/tasks";
  const t = db.prepare("SELECT t.*, s.name subject, u.name teacher FROM tasks t JOIN subjects s ON s.id=t.subject_id JOIN users u ON u.id=t.teacher_id WHERE t.id=?").get(id) as any;
  if (!t || (me.role === "teacher" && t.teacher_id !== me.id)) notFound();
  const content: TaskContent = JSON.parse(t.content_json);
  const n = countItems(content);
  const rows = taskResults(id);
  const done = rows.filter((r) => r.best !== null);
  const avg = done.length ? Math.round(done.reduce((a, r) => a + r.best!, 0) / done.length) : null;
  const grps = db.prepare("SELECT g.name FROM task_groups tg JOIN groups g ON g.id=tg.group_id WHERE tg.task_id=?").all(id).map((g: any) => g.name);

  return (
    <>
      <div className="topbar">
        <h1>{t.title}</h1>
        <div className="row">
          <a className="btn btn-ghost" href={`/api/tasks/${id}/export`}>导出成绩 Excel</a>
          <a className="btn btn-ghost" href={me.role === "admin" ? "/admin/tasks" : "/teacher"}>← 返回</a>
        </div>
      </div>
      <div className="grid3">
        <div className="card">
          <div className="muted small">学科 / 组别</div>
          <div><b>{t.subject}</b> · {grps.join("、")}</div>
          <div className="small muted" style={{ marginTop: 6 }}>
            {n.mcq > 0 && <>选择题 {n.mcq} 道　</>}
            {n.match > 0 && <>连线 {n.match} 对（{content.match!.mode === "en_cn" ? "英-中" : "英-释义"}）　</>}
            {n.cloze > 0 && <>填空 {n.cloze} 空（{content.cloze!.title}）</>}
          </div>
          <div className="small muted">每人 {t.max_attempts} 次，每题首次校验计分，取最高分{t.due_at ? ` · 截止 ${t.due_at.replace("T", " ")}` : ""}</div>
        </div>
        <div className="card"><div className="muted small">已完成</div><div className="stat">{done.length} / {rows.length}</div></div>
        <div className="card"><div className="muted small">平均最高分</div><div className="stat">{avg === null ? "—" : avg + "%"}</div></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>学生</th><th>组别</th>{Array.from({ length: t.max_attempts }, (_, i) => <th key={i}>第 {i + 1} 次</th>)}<th>最高分</th><th>最近提交</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><b>{r.name}</b> <span className="muted small">{r.username}</span></td>
                <td className="small">{r.grps}</td>
                {Array.from({ length: t.max_attempts }, (_, i) => {
                  const a = r.attempts[i];
                  return <td key={i}>{a ? <><a href={`${base}/${id}/student/${r.id}?n=${a.attempt_no}`}>{a.score}/{a.total}</a>{a.status === "in_progress" && <span className="badge warn" style={{ marginLeft: 4 }}>进行中</span>}</> : <span className="muted">—</span>}</td>;
                })}
                <td>{r.best === null ? <span className="badge gray">未做</span> : <span className={"badge " + (r.best >= 80 ? "ok" : r.best >= 60 ? "warn" : "bad")}>{r.best}%</span>}</td>
                <td className="small muted">{r.last ? r.last.slice(5, 16) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form action={deleteTask} style={{ marginTop: 16 }}>
        <input type="hidden" name="id" value={id} />
        <ConfirmButton message="删除该任务及全部成绩？">删除任务</ConfirmButton>
      </form>
    </>
  );
}
