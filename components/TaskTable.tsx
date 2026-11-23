import { db } from "@/lib/db";
import { configModes } from "@/lib/tasks";
import { getT } from "@/lib/i18n-server";

/** 任务列表（教师：自己的；admin：全部）。只统计已提交的作答 */
export default async function TaskTable({ teacherId, base }: { teacherId?: number; base: string }) {
  const t = await getT();
  const tasks = db
    .prepare(
      `SELECT t.*, s.name subject, u.name teacher,
        (SELECT COUNT(*) FROM task_students ts WHERE ts.task_id=t.id) n,
        (SELECT COUNT(DISTINCT a.student_id) FROM attempts a WHERE a.task_id=t.id AND a.status='submitted') done,
        (SELECT AVG(best) FROM (SELECT MAX(a.score*100.0/MAX(a.total,1)) best FROM attempts a WHERE a.task_id=t.id AND a.status='submitted' GROUP BY a.student_id)) avg,
        (SELECT GROUP_CONCAT(g.name, '、') FROM task_groups tg JOIN groups g ON g.id=tg.group_id WHERE tg.task_id=t.id) grps
       FROM tasks t JOIN subjects s ON s.id=t.subject_id JOIN users u ON u.id=t.teacher_id
       WHERE t.kind='task' ${teacherId ? "AND t.teacher_id = ?" : ""} ORDER BY t.id DESC`
    )
    .all(...(teacherId ? [teacherId] : [])) as any[];
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>{t("任务")}</th><th>{t("学科")}</th>{!teacherId && <th>{t("教师")}</th>}<th>{t("组别")}</th><th>{t("题型")}</th><th>{t("完成")}</th><th>{t("平均最高分")}</th><th>{t("发布时间")}</th></tr></thead>
        <tbody>
          {tasks.map((x) => {
            const c = JSON.parse(x.config_json);
            const modes = c.match ? configModes(c.match).map((m) => (m === "en_cn" ? t("英-中") : t("英-释义"))).join("+") : "";
            const types = [c.mcq && t("选择"), c.match && `${t("连线")}(${modes})`, c.cloze && t("填空")].filter(Boolean);
            return (
              <tr key={x.id}>
                <td><a href={`${base}/${x.id}`}><b>{x.title}</b></a>{x.due_at && <div className="small muted">{t(`截止 ${x.due_at.replace("T", " ")}`)}</div>}</td>
                <td>{x.subject}</td>
                {!teacherId && <td>{x.teacher}</td>}
                <td className="small">{x.grps}</td>
                <td className="small">{types.join(" / ")}</td>
                <td>{x.done} / {x.n}</td>
                <td>{x.avg == null ? <span className="muted">—</span> : Math.round(x.avg) + "%"}</td>
                <td className="small muted">{x.created_at.slice(0, 16)}</td>
              </tr>
            );
          })}
          {!tasks.length && <tr><td colSpan={8} className="muted">{t("还没有任务")}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
