import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { SP } from "@/lib/util";
import { getT } from "@/lib/i18n-server";
import { practiceSubjectIds, PRACTICE_LIMITS } from "@/lib/practice";
import { loadSubjectOptions } from "@/lib/subjectOptions";
import Flash from "@/components/Flash";
import PracticeForm from "./PracticeForm";
import { createPractice } from "./actions";

export default async function PracticePage({ searchParams }: { searchParams: SP }) {
  const me = await requireRole("student");
  const t = await getT();
  const sp = await searchParams;
  const ids = practiceSubjectIds(me);
  const subjects = ids.length ? loadSubjectOptions(ids) : [];
  const mine = db
    .prepare(
      `SELECT t.id, t.title, t.config_json, s.name subject,
         (SELECT COUNT(*) FROM attempts a WHERE a.task_id=t.id) used,
         (SELECT COUNT(*) FROM attempts a WHERE a.task_id=t.id AND a.status='in_progress') open,
         (SELECT MAX(a.score*100.0/MAX(a.total,1)) FROM attempts a WHERE a.task_id=t.id AND a.status='submitted') best
       FROM tasks t JOIN subjects s ON s.id=t.subject_id
       WHERE t.kind='practice' AND t.teacher_id=? ORDER BY t.id DESC LIMIT 30`
    )
    .all(me.id) as any[];
  return (
    <>
      <h1>{t("自由练习")}</h1>
      <p className="muted small">{t("自己选学科、题型和数量组一份练习。可以反复刷，成绩只自己可见，不计入老师布置的任务。")}</p>
      <Flash ok={sp.ok} err={sp.err} />
      {!subjects.length ? (
        <div className="card muted">{t("老师还没有为你开放自由练习。")}</div>
      ) : (
        <PracticeForm subjects={subjects} limits={PRACTICE_LIMITS} action={createPractice} />
      )}
      {mine.length > 0 && (
        <>
          <h2 style={{ marginTop: 24 }}>{t("我的练习记录")}</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t("练习")}</th><th>{t("题型")}</th><th>{t("次数")}</th><th>{t("最高分")}</th><th></th></tr></thead>
              <tbody>
                {mine.map((p) => {
                  const c = JSON.parse(p.config_json);
                  const types = [c.mcq && t("选择"), c.match && t("连线"), c.cloze && t("填空")].filter(Boolean);
                  return (
                    <tr key={p.id}>
                      <td><a href={`/student/tasks/${p.id}`}><b>{p.title}</b></a></td>
                      <td className="small">{types.join(" / ")}</td>
                      <td>{p.used}</td>
                      <td>{p.best == null ? <span className="muted">—</span> : Math.round(p.best) + "%"}</td>
                      <td><a className="btn btn-sm btn-ghost" href={`/student/tasks/${p.id}`}>{p.open ? t("继续") : t("再练一次")}</a></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
