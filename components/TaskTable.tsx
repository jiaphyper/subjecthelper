import { db } from "@/lib/db";

/** 任务列表（教师：自己的；admin：全部） */
export default function TaskTable({ teacherId, base }: { teacherId?: number; base: string }) {
  const tasks = db
    .prepare(
      `SELECT t.*, s.name subject, u.name teacher,
        (SELECT COUNT(*) FROM task_students ts WHERE ts.task_id=t.id) n,
        (SELECT COUNT(DISTINCT a.student_id) FROM attempts a WHERE a.task_id=t.id) done,
        (SELECT AVG(best) FROM (SELECT MAX(a.score*100.0/MAX(a.total,1)) best FROM attempts a WHERE a.task_id=t.id GROUP BY a.student_id)) avg,
        (SELECT GROUP_CONCAT(g.name, '、') FROM task_groups tg JOIN groups g ON g.id=tg.group_id WHERE tg.task_id=t.id) grps
       FROM tasks t JOIN subjects s ON s.id=t.subject_id JOIN users u ON u.id=t.teacher_id
       ${teacherId ? "WHERE t.teacher_id = ?" : ""} ORDER BY t.id DESC`
    )
    .all(...(teacherId ? [teacherId] : [])) as any[];
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>任务</th><th>学科</th>{!teacherId && <th>教师</th>}<th>组别</th><th>题型</th><th>完成</th><th>平均最高分</th><th>发布时间</th></tr></thead>
        <tbody>
          {tasks.map((t) => {
            const c = JSON.parse(t.config_json);
            const types = [c.mcq && "选择", c.match && (c.match.mode === "en_cn" ? "连线(英-中)" : "连线(英-释义)"), c.cloze && "填空"].filter(Boolean);
            return (
              <tr key={t.id}>
                <td><a href={`${base}/${t.id}`}><b>{t.title}</b></a>{t.due_at && <div className="small muted">截止 {t.due_at.replace("T", " ")}</div>}</td>
                <td>{t.subject}</td>
                {!teacherId && <td>{t.teacher}</td>}
                <td className="small">{t.grps}</td>
                <td className="small">{types.join(" / ")}</td>
                <td>{t.done} / {t.n}</td>
                <td>{t.avg == null ? <span className="muted">—</span> : Math.round(t.avg) + "%"}</td>
                <td className="small muted">{t.created_at.slice(0, 16)}</td>
              </tr>
            );
          })}
          {!tasks.length && <tr><td colSpan={8} className="muted">还没有任务</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
