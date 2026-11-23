import { db } from "./db";
import { grade, publicContent, TaskContent } from "./tasks";

export const isOverdue = (due: string | null | undefined) => !!due && new Date(due) < new Date();

/** 学生能否访问该任务、还能否作答。过了截止时间的进行中作答会被自动提交 */
export function studentTaskState(taskId: number, studentId: number) {
  const t = db
    .prepare(
      `SELECT t.*, s.name subject, u.name teacher FROM tasks t
       JOIN task_students ts ON ts.task_id=t.id AND ts.student_id=?
       JOIN subjects s ON s.id=t.subject_id JOIN users u ON u.id=t.teacher_id WHERE t.id=?`
    )
    .get(studentId, taskId) as any;
  if (!t) return null;
  const practice = t.kind === "practice";
  const overdue = !practice && isOverdue(t.due_at);
  if (overdue) {
    const open = db.prepare("SELECT id FROM attempts WHERE task_id=? AND student_id=? AND status='in_progress'").all(taskId, studentId) as { id: number }[];
    open.forEach((a) => finishAttempt(a.id));
  }
  const attempts = db.prepare("SELECT * FROM attempts WHERE task_id=? AND student_id=? ORDER BY attempt_no").all(taskId, studentId) as any[];
  const inProgress = attempts.find((a) => a.status === "in_progress") ?? null;
  const remaining = practice ? Infinity : Math.max(0, t.max_attempts - attempts.length);
  return { task: t, practice, attempts, inProgress, overdue, remaining, canStart: !inProgress && remaining > 0 && !overdue };
}

/** 新开一次作答（占用一次机会）：题目不变，本次的题目/选项/卡片顺序重新打乱并冻结 */
export function startAttempt(taskId: number, studentId: number) {
  const st = studentTaskState(taskId, studentId);
  if (!st) return null;
  if (st.inProgress) return st.inProgress.id as number;
  if (!st.canStart) return null;
  const content: TaskContent = JSON.parse(st.task.content_json);
  const total = grade(content, {}).total;
  const r = db
    .prepare("INSERT INTO attempts (task_id, student_id, attempt_no, layout_json, total) VALUES (?,?,?,?,?)")
    .run(taskId, studentId, st.attempts.length + 1, JSON.stringify(publicContent(content)), total);
  return Number(r.lastInsertRowid);
}

/** 根据已记录的首次答案重新计算总分 */
export function recompute(attemptId: number) {
  const a = db.prepare("SELECT a.answers_json, t.content_json FROM attempts a JOIN tasks t ON t.id=a.task_id WHERE a.id=?").get(attemptId) as any;
  const result = grade(JSON.parse(a.content_json), JSON.parse(a.answers_json));
  db.prepare("UPDATE attempts SET result_json=?, score=?, total=? WHERE id=?").run(JSON.stringify(result), result.score, result.total, attemptId);
  return result;
}

/** 结束一次作答（学生主动提交 / 截止后自动提交） */
export function finishAttempt(attemptId: number) {
  return db.transaction(() => {
    const result = recompute(attemptId);
    db.prepare("UPDATE attempts SET status='submitted', submitted_at=datetime('now'), draft_json='{}' WHERE id=? AND status='in_progress'").run(attemptId);
    return result;
  })();
}
