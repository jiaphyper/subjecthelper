"use server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { str, int, ints, back } from "@/lib/util";
import { buildContent, countItems, parseConfig } from "@/lib/tasks";

export async function createTask(fd: FormData) {
  const me = await requireRole("teacher");
  const title = str(fd, "title");
  const subjectId = int(fd, "subject_id");
  const groupIds = ints(fd, "group");
  const onlyMine = fd.get("only_mine") === "1";
  const maxAttempts = Math.max(1, Math.min(10, int(fd, "max_attempts") ?? 3));
  const due = str(fd, "due_at") || null;
  const fail = (err: string) => back("/teacher/tasks/new", { err });

  if (!title) fail("请填写任务名称");
  if (!subjectId) fail("请选择学科");
  if (due && Number.isNaN(new Date(due).getTime())) fail("截止时间格式不正确");
  if (due && new Date(due) < new Date()) fail("截止时间不能早于现在");
  const { cfg, error } = parseConfig(fd);
  if (error) fail(error);
  if (!groupIds.length) fail("请至少勾选一个组别");

  // 只允许自己的组别
  const okGroups = groupIds.filter((g) => (db.prepare("SELECT teacher_id FROM groups WHERE id=?").get(g) as any)?.teacher_id === me.id);
  if (!okGroups.length) fail("所选组别无效");
  const ph = okGroups.map(() => "?").join(",");
  const students = db
    .prepare(
      `SELECT DISTINCT m.student_id id FROM group_members m JOIN users u ON u.id=m.student_id
       WHERE m.group_id IN (${ph}) AND u.active=1 AND u.role='student'
       ${onlyMine ? "AND EXISTS (SELECT 1 FROM teacher_students ts WHERE ts.teacher_id=? AND ts.student_id=u.id)" : ""}`
    )
    .all(...okGroups, ...(onlyMine ? [me.id] : [])) as { id: number }[];
  if (!students.length) fail(onlyMine ? "所选组别中没有绑定给你的学生" : "所选组别中没有学生");

  const { content, warnings } = buildContent(subjectId!, cfg);
  const n = countItems(content);
  if (n.mcq + n.match + n.cloze === 0) fail("所选条件下题库中没有题目：" + warnings.join("；"));

  const taskId = db.transaction(() => {
    const id = Number(
      db.prepare("INSERT INTO tasks (title, subject_id, teacher_id, org_id, config_json, content_json, max_attempts, due_at, kind) VALUES (?,?,?,?,?,?,?,?, 'task')")
        .run(title, subjectId, me.id, me.org_id, JSON.stringify({ ...cfg, onlyMine }), JSON.stringify(content), maxAttempts, due).lastInsertRowid
    );
    const tg = db.prepare("INSERT INTO task_groups VALUES (?,?)");
    const ts = db.prepare("INSERT INTO task_students VALUES (?,?)");
    okGroups.forEach((g) => tg.run(id, g));
    students.forEach((s) => ts.run(id, s.id));
    return id;
  })();
  back(`/teacher/tasks/${taskId}`, { ok: `任务已发布给 ${students.length} 名学生${warnings.length ? "。注意：" + warnings.join("；") : ""}` });
}

export async function deleteTask(fd: FormData) {
  const me = await requireRole("teacher", "admin");
  const id = int(fd, "id");
  const t = db.prepare("SELECT teacher_id FROM tasks WHERE id=?").get(id) as any;
  if (!t || (me.role === "teacher" && t.teacher_id !== me.id)) back("/teacher", { err: "无权删除" });
  db.prepare("DELETE FROM tasks WHERE id=?").run(id);
  back(me.role === "admin" ? "/admin/tasks" : "/teacher", { ok: "任务已删除" });
}
