import { db, User } from "@/lib/db";
import { getT } from "@/lib/i18n-server";
import { grantPractice, revokePractice } from "@/lib/practiceActions";
import ConfirmButton from "./ConfirmButton";
import { teacherSubjectIds } from "@/lib/practice";
import Pager, { pageOf, PER_PAGE } from "./Pager";

/** 自由练习开放设置（admin / 教师共用） */
export default async function PracticeAdmin({ me, sp = {} }: { me: User; sp?: Record<string, string | undefined> }) {
  const t = await getT();
  const isAdmin = me.role === "admin";
  const allSubjects = db.prepare("SELECT id, name FROM subjects ORDER BY name").all() as { id: number; name: string }[];
  // 教师只能开放自己负责的学科
  const mineIds = isAdmin ? null : teacherSubjectIds(me.id);
  const subjects = mineIds ? allSubjects.filter((s) => mineIds.includes(s.id)) : allSubjects;
  const orgs = isAdmin ? (db.prepare("SELECT id, name FROM orgs ORDER BY name").all() as { id: number; name: string }[]) : [];
  const groups = db
    .prepare(`SELECT g.id, g.name, o.name org, u.name teacher FROM groups g JOIN orgs o ON o.id=g.org_id LEFT JOIN users u ON u.id=g.teacher_id ${isAdmin ? "" : "WHERE g.teacher_id=?"} ORDER BY o.name, g.name`)
    .all(...(isAdmin ? [] : [me.id])) as any[];
  /* 已开放列表：每页 30 条；admin 可按学科 / 教师 / 范围筛选 */
  const { page, offset } = pageOf(sp);
  const gw: string[] = [];
  const ga: any[] = [];
  if (!isAdmin) { gw.push("(p.scope<>'group' OR g.teacher_id=?)"); ga.push(me.id); }
  if (sp.subject) { gw.push("p.subject_id=?"); ga.push(Number(sp.subject)); }
  if (isAdmin && sp.teacher) { gw.push("(p.granted_by=? OR g.teacher_id=?)"); ga.push(Number(sp.teacher), Number(sp.teacher)); }
  if (isAdmin && sp.scope) { gw.push("p.scope=?"); ga.push(sp.scope); }
  const GW = gw.length ? "WHERE " + gw.join(" AND ") : "";
  const FROM = `FROM practice_grants p JOIN subjects s ON s.id=p.subject_id
       LEFT JOIN orgs o ON o.id=p.org_id LEFT JOIN groups g ON g.id=p.group_id LEFT JOIN users u ON u.id=p.granted_by`;
  const grantTotal = (db.prepare(`SELECT COUNT(*) c ${FROM} ${GW}`).get(...ga) as { c: number }).c;
  const grants = db
    .prepare(
      `SELECT p.*, s.name subject, o.name org, g.name grp, g.teacher_id, u.name by_name,
         CASE p.scope WHEN 'all' THEN (SELECT COUNT(*) FROM users WHERE role='student' AND active=1)
                      WHEN 'org' THEN (SELECT COUNT(*) FROM users WHERE role='student' AND active=1 AND org_id=p.org_id)
                      ELSE (SELECT COUNT(*) FROM group_members WHERE group_id=p.group_id) END n
       ${FROM} ${GW}
       ORDER BY p.id DESC LIMIT ${PER_PAGE} OFFSET ${offset}`
    )
    .all(...ga) as any[];
  const teachers = isAdmin ? (db.prepare("SELECT id, name, username FROM users WHERE role='teacher' ORDER BY name").all() as any[]) : [];
  const gFiltered = !!(sp.subject || sp.teacher || sp.scope);
  const basePath = isAdmin ? "/admin/practice" : "/teacher/practice";
  // 教师看看自己组里学生的练习情况（近 7 天）
  const activity = !isAdmin
    ? (db
        .prepare(
          `SELECT u.id, u.name, u.username, COUNT(a.id) n, AVG(a.score*100.0/MAX(a.total,1)) avg, MAX(a.submitted_at) last
           FROM users u
           LEFT JOIN tasks t ON t.teacher_id=u.id AND t.kind='practice'
           LEFT JOIN attempts a ON a.task_id=t.id AND a.status='submitted' AND a.submitted_at >= datetime('now','-7 days')
           WHERE u.id IN (SELECT m.student_id FROM group_members m JOIN groups g ON g.id=m.group_id WHERE g.teacher_id=?)
           GROUP BY u.id ORDER BY n DESC, u.username`
        )
        .all(me.id) as any[])
    : [];

  const scopeLabel = (p: any) =>
    p.scope === "all" ? t("全部学生") : p.scope === "org" ? t(`学校：${p.org}`) : t(`组别：${p.grp}`);

  return (
    <>
      <h1>{t("自由练习")}</h1>
      <p className="muted small">{t("开放后，学生可以在「自由练习」里自己选题型和数量组卷，反复刷题。练习成绩不计入任务成绩。")}</p>
      {!isAdmin && (
        <p className="small">
          {t("我负责的学科：")}
          {subjects.length ? subjects.map((s) => <span key={s.id} className="badge" style={{ marginRight: 6 }}>{s.name}</span>) : <span className="muted">{t("还没有分配，请联系管理员在「账号管理」中设置")}</span>}
        </p>
      )}
      {(isAdmin || subjects.length > 0) && (
      <form action={grantPractice} className="card">
        <h2>{t("开放新的学科")}</h2>
        <div className="field">
          <label>{t("学科（可多选）")}</label>
          <div className="row">
            {subjects.map((s) => (
              <label key={s.id} className="row" style={{ margin: 0, color: "var(--ink)" }}><input type="checkbox" name="subject" value={s.id} /> {s.name}</label>
            ))}
            {!subjects.length && <span className="muted small">{t("还没有学科")}</span>}
          </div>
        </div>
        {isAdmin ? (
          <div className="field">
            <label>{t("开放范围")}</label>
            <div className="stack">
              <label className="row" style={{ margin: 0, color: "var(--ink)" }}><input type="radio" name="scope" value="all" /> {t("全部学生")}</label>
              <label className="row" style={{ margin: 0, color: "var(--ink)" }}>
                <input type="radio" name="scope" value="org" /> {t("某个学校：")}
                <select name="org_id" style={{ width: 220 }}><option value="">{t("选择学校…")}</option>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
              </label>
              <label className="row" style={{ margin: 0, color: "var(--ink)" }}><input type="radio" name="scope" value="group" defaultChecked /> {t("指定组别（在下方勾选）：")}</label>
            </div>
          </div>
        ) : null}
        <div className="checklist" style={{ maxHeight: 220 }}>
          {groups.map((g) => (
            <label key={g.id}><input type="checkbox" name="group" value={g.id} /> <b>{g.name}</b> <span className="muted small">{isAdmin ? `${g.org} · ${g.teacher ?? "—"}` : ""}</span></label>
          ))}
          {!groups.length && <div className="muted small">{t("还没有组别")}</div>}
        </div>
        <button style={{ marginTop: 12 }}>{t("开放")}</button>
      </form>
      )}

      <h2>{t("已开放")}</h2>
      {isAdmin && (
        <form className="row card filter-bar" method="get" action={basePath}>
          <select name="subject" defaultValue={sp.subject ?? ""} style={{ width: 180 }}>
            <option value="">{t("全部学科")}</option>
            {allSubjects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          <select name="teacher" defaultValue={sp.teacher ?? ""} style={{ width: 170 }}>
            <option value="">{t("全部教师")}</option>
            {teachers.map((x) => <option key={x.id} value={x.id}>{x.name}（{x.username}）</option>)}
          </select>
          <select name="scope" defaultValue={sp.scope ?? ""} style={{ width: 150 }}>
            <option value="">{t("全部范围")}</option>
            <option value="all">{t("全部学生")}</option>
            <option value="org">{t("学校")}</option>
            <option value="group">{t("组别")}</option>
          </select>
          <button className="btn-ghost">{t("筛选")}</button>
          {gFiltered && <a className="small" href={basePath}>{t("清除筛选")}</a>}
        </form>
      )}
      <div className="table-wrap">
        <table>
          <thead><tr><th>{t("学科")}</th><th>{t("范围")}</th><th>{t("学生数")}</th><th>{t("开放人")}</th><th></th></tr></thead>
          <tbody>
            {grants.map((p) => {
              const canRevoke = isAdmin || (p.scope === "group" && p.teacher_id === me.id);
              return (
                <tr key={p.id}>
                  <td><b>{p.subject}</b></td>
                  <td>{scopeLabel(p)}</td>
                  <td>{p.n}</td>
                  <td className="small muted">{p.by_name ?? "—"}</td>
                  <td>
                    {canRevoke ? (
                      <form action={revokePractice} className="inline-form">
                        <input type="hidden" name="id" value={p.id} />
                        <ConfirmButton message={t("关闭该开放？学生已有的练习记录会保留。")}>{t("关闭")}</ConfirmButton>
                      </form>
                    ) : <span className="small muted">{t("由管理员开放")}</span>}
                  </td>
                </tr>
              );
            })}
            {!grants.length && <tr><td colSpan={5} className="muted">{gFiltered ? t("没有符合条件的记录") : t("还没有开放任何学科")}</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager path={basePath} params={sp} page={page} total={grantTotal} />

      {!isAdmin && (
        <>
          <h2 style={{ marginTop: 24 }}>{t("学生练习情况（近 7 天）")}</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t("学生")}</th><th>{t("练习次数")}</th><th>{t("平均分")}</th><th>{t("最近练习")}</th></tr></thead>
              <tbody>
                {activity.map((r) => (
                  <tr key={r.id}>
                    <td><b>{r.name}</b> <span className="muted small">{r.username}</span></td>
                    <td>{r.n}</td>
                    <td>{r.avg == null ? <span className="muted">—</span> : Math.round(r.avg) + "%"}</td>
                    <td className="small muted">{r.last ? String(r.last).slice(5, 16) : "—"}</td>
                  </tr>
                ))}
                {!activity.length && <tr><td colSpan={4} className="muted">{t("组别里还没有学生")}</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
