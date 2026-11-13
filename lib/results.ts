import { db } from "./db";
import { pct } from "./tasks";

export function taskResults(taskId: number) {
  const students = db
    .prepare(
      `SELECT u.id, u.username, u.name,
        (SELECT GROUP_CONCAT(g.name, '、') FROM task_groups tg JOIN group_members m ON m.group_id=tg.group_id AND m.student_id=u.id JOIN groups g ON g.id=tg.group_id WHERE tg.task_id=?) grps
       FROM task_students ts JOIN users u ON u.id=ts.student_id WHERE ts.task_id=? ORDER BY grps, u.username`
    )
    .all(taskId, taskId) as any[];
  const attempts = db.prepare("SELECT student_id, attempt_no, score, total, status, COALESCE(submitted_at, started_at) submitted_at FROM attempts WHERE task_id=? ORDER BY attempt_no").all(taskId) as any[];
  return students.map((s) => {
    const mine = attempts.filter((a) => a.student_id === s.id);
    const best = mine.length ? Math.max(...mine.map((a) => pct(a.score, a.total))) : null;
    return { ...s, attempts: mine.map((a) => ({ ...a, pct: pct(a.score, a.total) })), best, last: mine.length ? mine[mine.length - 1].submitted_at : null };
  });
}
