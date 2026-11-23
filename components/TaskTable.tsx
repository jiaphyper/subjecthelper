import { db } from "@/lib/db";
import { configModes } from "@/lib/tasks";
import { getT } from "@/lib/i18n-server";
import Pager, { pageOf, PER_PAGE } from "./Pager";

type Params = Record<string, string | undefined>;

/**
 * 任务列表（教师：自己的；admin：全部），每页 30 条，可筛选。只统计已提交的作答。
 * 筛选参数：q 任务名，subject 学科，teacher 教师（admin），org 学校（admin）
 */
export default async function TaskTable({ teacherId, base, path, sp = {} }: { teacherId?: number; base: string; path: string; sp?: Params }) {
  const t = await getT();
  const isAdmin = !teacherId;
  const { page, offset } = pageOf(sp);
  const where = ["t.kind='task'"];
  const args: any[] = [];
  if (teacherId) { where.push("t.teacher_id = ?"); args.push(teacherId); }
  if (sp.q) { where.push("t.title LIKE ?"); args.push(`%${sp.q}%`); }
  if (sp.subject) { where.push("t.subject_id = ?"); args.push(Number(sp.subject)); }
  if (isAdmin && sp.teacher) { where.push("t.teacher_id = ?"); args.push(Number(sp.teacher)); }
  if (isAdmin && sp.org) { where.push("t.org_id = ?"); args.push(Number(sp.org)); }
  const W = "WHERE " + where.join(" AND ");

  const total = (db.prepare(`SELECT COUNT(*) c FROM tasks t ${W}`).get(...args) as { c: number }).c;
  const tasks = db
    .prepare(
      `SELECT t.*, s.name subject, u.name teacher,
        (SELECT COUNT(*) FROM task_students ts WHERE ts.task_id=t.id) n,
        (SELECT COUNT(DISTINCT a.student_id) FROM attempts a WHERE a.task_id=t.id AND a.status='submitted') done,
        (SELECT AVG(best) FROM (SELECT MAX(a.score*100.0/MAX(a.total,1)) best FROM attempts a WHERE a.task_id=t.id AND a.status='submitted' GROUP BY a.student_id)) avg,
        (SELECT GROUP_CONCAT(g.name, '、') FROM task_groups tg JOIN groups g ON g.id=tg.group_id WHERE tg.task_id=t.id) grps
       FROM tasks t JOIN subjects s ON s.id=t.subject_id JOIN users u ON u.id=t.teacher_id
       ${W} ORDER BY t.id DESC LIMIT ${PER_PAGE} OFFSET ${offset}`
    )
    .all(...args) as any[];

  const subjects = db.prepare("SELECT id, name FROM subjects ORDER BY name").all() as { id: number; name: string }[];
  const teachers = isAdmin ? (db.prepare("SELECT id, name, username FROM users WHERE role='teacher' ORDER BY name").all() as any[]) : [];
  const orgs = isAdmin ? (db.prepare("SELECT id, name FROM orgs ORDER BY name").all() as any[]) : [];
  const filtered = !!(sp.q || sp.subject || sp.teacher || sp.org);

  return (
    <>
      <form className="row card filter-bar" method="get" action={path}>
        <input type="text" name="q" defaultValue={sp.q ?? ""} placeholder={t("搜索任务名")} style={{ width: 200 }} />
        <select name="subject" defaultValue={sp.subject ?? ""} style={{ width: 180 }}>
          <option value="">{t("全部学科")}</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {isAdmin && (
          <select name="teacher" defaultValue={sp.teacher ?? ""} style={{ width: 160 }}>
            <option value="">{t("全部教师")}</option>
            {teachers.map((x) => <option key={x.id} value={x.id}>{x.name}（{x.username}）</option>)}
          </select>
        )}
        {isAdmin && (
          <select name="org" defaultValue={sp.org ?? ""} style={{ width: 160 }}>
            <option value="">{t("全部学校")}</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
        <button className="btn-ghost">{t("筛选")}</button>
        {filtered && <a className="small" href={path}>{t("清除筛选")}</a>}
      </form>
      <div className="table-wrap">
        <table>
          <thead><tr><th>{t("任务")}</th><th>{t("学科")}</th>{isAdmin && <th>{t("教师")}</th>}<th>{t("组别")}</th><th>{t("题型")}</th><th>{t("完成")}</th><th>{t("平均最高分")}</th><th>{t("发布时间")}</th></tr></thead>
          <tbody>
            {tasks.map((x) => {
              const c = JSON.parse(x.config_json);
              const modes = c.match ? configModes(c.match).map((m) => (m === "en_cn" ? t("英-中") : t("英-释义"))).join("+") : "";
              const types = [c.mcq && t("选择"), c.match && `${t("连线")}(${modes})`, c.cloze && t("填空")].filter(Boolean);
              return (
                <tr key={x.id}>
                  <td><a href={`${base}/${x.id}`}><b>{x.title}</b></a>{x.due_at && <div className="small muted">{t(`截止 ${x.due_at.replace("T", " ")}`)}</div>}</td>
                  <td>{x.subject}</td>
                  {isAdmin && <td>{x.teacher}</td>}
                  <td className="small">{x.grps}</td>
                  <td className="small">{types.join(" / ")}</td>
                  <td>{x.done} / {x.n}</td>
                  <td>{x.avg == null ? <span className="muted">—</span> : Math.round(x.avg) + "%"}</td>
                  <td className="small muted">{x.created_at.slice(0, 16)}</td>
                </tr>
              );
            })}
            {!tasks.length && <tr><td colSpan={8} className="muted">{filtered ? t("没有符合条件的任务") : t("还没有任务")}</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager path={path} params={sp} page={page} total={total} />
    </>
  );
}
