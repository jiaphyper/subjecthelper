import { db } from "./db";
import { grade, publicContent, TaskContent } from "./tasks";

/** 学生能否访问该任务、还能否作答 */
export function studentTaskState(taskId: number, studentId: number) {
  const t = db
    .prepare(
      `SELECT t.*, s.name subject, u.name teacher FROM tasks t
       JOIN task_students ts ON ts.task_id=t.id AND ts.student_id=?
       JOIN subjects s ON s.id=t.subject_id JOIN users u ON u.id=t.teacher_id WHERE t.id=?`
    )
    .get(studentId, taskId) as any;
  if (!t) return null;
  const attempts = db.prepare("SELECT * FROM attempts WHERE task_id=? AND student_id=? ORDER BY attempt_no").all(taskId, studentId) as any[];
  const inProgress = attempts.find((a) => a.status === "in_progress") ?? null;
  const overdue = !!t.due_at && new Date(t.due_at) < new Date();
  const remaining = Math.max(0, t.max_attempts - attempts.length);
  return { task: t, attempts, inProgress, overdue, remaining, canStart: !inProgress && remaining > 0 && !overdue };
}

/** 新开一次作答（占用一次机会），冻结本次的题目排列 */
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
