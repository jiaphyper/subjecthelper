"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { int, back } from "@/lib/util";
import { buildContent, countItems, parseConfig } from "@/lib/tasks";
import { practiceSubjectIds, PRACTICE_LIMITS, PRACTICE_ATTEMPTS } from "@/lib/practice";
import { startAttempt } from "@/lib/studentTask";

/** 学生自由组卷：生成一份练习（kind=practice，teacher_id 存学生本人）并直接开始 */
export async function createPractice(fd: FormData) {
  const me = await requireRole("student");
  const subjectId = int(fd, "subject_id");
  const fail = (err: string) => back("/student/practice", { err });
  if (!subjectId || !practiceSubjectIds(me).includes(subjectId)) fail("该学科没有开放自由练习");
  const { cfg, error } = parseConfig(fd, PRACTICE_LIMITS);
  if (error) fail(error);
  const { content, warnings } = buildContent(subjectId!, cfg);
  const n = countItems(content);
  if (n.mcq + n.match + n.cloze === 0) fail("所选条件下题库中没有题目：" + warnings.join("；"));
  const subject = (db.prepare("SELECT name FROM subjects WHERE id=?").get(subjectId) as { name: string }).name;
  const stamp = new Date().toISOString().slice(5, 16).replace("T", " ");
  const taskId = db.transaction(() => {
    const id = Number(
      db.prepare("INSERT INTO tasks (title, subject_id, teacher_id, org_id, config_json, content_json, max_attempts, kind) VALUES (?,?,?,?,?,?,?, 'practice')")
        .run(`${subject} · ${stamp}`, subjectId, me.id, me.org_id, JSON.stringify(cfg), JSON.stringify(content), PRACTICE_ATTEMPTS).lastInsertRowid
    );
    db.prepare("INSERT INTO task_students VALUES (?,?)").run(id, me.id);
    return id;
  })();
  startAttempt(taskId, me.id);
  redirect(`/student/tasks/${taskId}/do`);
}
