import { db } from "./db";
import { currentUser } from "./auth";

/** 取当前学生自己的、进行中的作答 */
export async function myOpenAttempt(aid: number) {
  const me = await currentUser();
  if (me?.role !== "student") return { error: "请先登录", status: 401 } as const;
  const a = db
    .prepare("SELECT a.*, t.content_json, t.due_at FROM attempts a JOIN tasks t ON t.id=a.task_id WHERE a.id=? AND a.student_id=?")
    .get(aid, me.id) as any;
  if (!a) return { error: "作答记录不存在", status: 404 } as const;
  if (a.status !== "in_progress") return { error: "本次作答已结束", status: 400 } as const;
  return { a } as const;
}
