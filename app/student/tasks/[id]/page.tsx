import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { studentTaskState, startAttempt } from "@/lib/studentTask";
import { pct } from "@/lib/tasks";
import { getT } from "@/lib/i18n-server";
import AttemptReview from "@/components/AttemptReview";
import ConfirmButton from "@/components/ConfirmButton";
import { SP } from "@/lib/util";

async function start(fd: FormData) {
  "use server";
  const me = await requireRole("student");
  const id = Number(fd.get("task_id"));
  const aid = startAttempt(id, me.id);
  redirect(aid ? `/student/tasks/${id}/do` : `/student/tasks/${id}`);
}

async function removePractice(fd: FormData) {
  "use server";
  const me = await requireRole("student");
  db.prepare("DELETE FROM tasks WHERE id=? AND kind='practice' AND teacher_id=?").run(Number(fd.get("task_id")), me.id);
  redirect("/student/practice");
}

export default async function StudentTask({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const me = await requireRole("student");
  const t = await getT();
  const id = Number((await params).id);
  const sp = await searchParams;
  const st = studentTaskState(id, me.id);
  if (!st) notFound();
  const { task, attempts, remaining, canStart, overdue, inProgress, practice } = st;
  const finished = attempts.filter((a) => a.status === "submitted");
  const best = finished.length ? Math.max(...finished.map((a) => pct(a.score, a.total))) : null;
  const shown = finished.find((a) => String(a.attempt_no) === sp.n) ?? finished[finished.length - 1];
  const justDone = sp.done === "1" && shown;
  // 任务：还有机会时只标对错；次数用完 / 截止后显示正确答案。自由练习：提交后即显示答案
  const showAnswers = practice || (!canStart && !inProgress);

  let status: string;
  if (inProgress) status = t(`第 ${inProgress.attempt_no} 次作答进行中（已得 ${inProgress.score} 分），可以继续`);
  else if (practice) status = t("自由练习：不限次数，每次题目相同、顺序重新打乱，成绩不计入老师的任务。");
  else if (canStart) status = t(`还有 ${remaining} 次机会，成绩取最高分。每题第一次校验的结果计分。`);
  else if (overdue) status = t("任务已截止，下面显示正确答案");
  else status = t(`${task.max_attempts} 次机会已用完，下面显示正确答案`);

  return (
    <>
      <a href={practice ? "/student/practice" : "/student"} className="small">{practice ? t("← 自由练习") : t("← 我的任务")}</a>
      <h1 style={{ marginTop: 8 }}>{task.title}</h1>
      <p className="muted small">{task.subject}{practice ? "" : ` · ${task.teacher}`}{task.due_at && !practice ? ` · ${t(`截止 ${task.due_at.replace("T", " ")}`)}` : ""}</p>

      {justDone && (
        <div className="card score-card" style={{ background: pct(shown.score, shown.total) >= 80 ? "var(--ok-soft)" : "var(--warn-soft)" }}>
          <div className="muted">{t(`第 ${shown.attempt_no} 次得分`)}</div>
          <div className="score-big">{shown.score} / {shown.total}</div>
          <div>{pct(shown.score, shown.total)}%</div>
        </div>
      )}

      <div className="card row">
        <div style={{ flex: 1 }}>
          <div>
            {practice ? t(`已练习 ${attempts.length} 次`) : t(`已用 ${attempts.length} / ${task.max_attempts} 次机会`)} · {t("最高分")} <b>{best === null ? "—" : best + "%"}</b>
          </div>
          <div className="small muted">{status}</div>
        </div>
        {inProgress && <a className="btn" href={`/student/tasks/${id}/do`} style={{ padding: "10px 22px" }}>{t("继续作答")}</a>}
        {canStart && (
          <form action={start}>
            <input type="hidden" name="task_id" value={id} />
            {practice ? (
              <button>{attempts.length ? t("再练一次") : t("开始练习")}</button>
            ) : (
              <ConfirmButton className="" message={t(`开始第 ${attempts.length + 1} 次作答？开始后即使用掉 1 次机会（共 ${task.max_attempts} 次）。`)}>
                {attempts.length ? t("再做一次") : t("开始作答")}
              </ConfirmButton>
            )}
          </form>
        )}
      </div>

      {finished.length > 0 && (
        <>
          <div className="row" style={{ marginBottom: 12 }}>
            {finished.map((a) => (
              <a key={a.id} href={`?n=${a.attempt_no}`} className={"btn btn-sm " + (a.id === shown.id ? "" : "btn-ghost")}>
                {t(`第 ${a.attempt_no} 次 · ${a.score}/${a.total}`)}
              </a>
            ))}
          </div>
          {!showAnswers && <p className="small muted">{t("✅ 对　❌ 错（按每题第一次校验计）。正确答案会在机会用完后显示。")}</p>}
          <AttemptReview content={JSON.parse(task.content_json)} result={JSON.parse(shown.result_json)} answers={JSON.parse(shown.answers_json)} showAnswers={showAnswers} />
        </>
      )}

      {practice && !inProgress && (
        <form action={removePractice} style={{ marginTop: 16 }}>
          <input type="hidden" name="task_id" value={id} />
          <ConfirmButton message={t("删除这次练习记录？")}>{t("删除练习")}</ConfirmButton>
        </form>
      )}
    </>
  );
}
