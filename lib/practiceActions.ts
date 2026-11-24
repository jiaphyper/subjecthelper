"use server";
import { db } from "./db";
import { requireRole } from "./auth";
import { str, int, ints, back } from "./util";
import { teacherSubjectIds } from "./practice";

const base = (role: string) => (role === "admin" ? "/admin/practice" : "/teacher/practice");

/** 开放自由练习：admin 可开放给全部学生 / 某学校 / 某组别；教师只能开放给自己的组别 */
export async function grantPractice(fd: FormData) {
  const me = await requireRole("admin", "teacher");
  let subjectIds = ints(fd, "subject");
  if (!subjectIds.length) back(base(me.role), { err: "请至少选择一个学科" });
  if (me.role === "teacher") {
    const mine = teacherSubjectIds(me.id);
    subjectIds = subjectIds.filter((s) => mine.includes(s));
    if (!subjectIds.length) back(base(me.role), { err: "只能开放你负责的学科" });
  }
  const ins = db.prepare("INSERT INTO practice_grants (subject_id, scope, org_id, group_id, granted_by) VALUES (?,?,?,?,?)");
  const exists = db.prepare("SELECT 1 FROM practice_grants WHERE subject_id=? AND scope=? AND COALESCE(org_id,0)=COALESCE(?,0) AND COALESCE(group_id,0)=COALESCE(?,0)");
  const targets: { scope: string; org: number | null; group: number | null }[] = [];
  if (me.role === "admin") {
    const scope = str(fd, "scope");
    if (scope === "all") targets.push({ scope, org: null, group: null });
    else if (scope === "org") {
      const org = int(fd, "org_id");
      if (!org) back(base(me.role), { err: "请选择学校" });
      targets.push({ scope, org, group: null });
    } else if (scope === "teacher") {
      // 指定教师：授权学科给教师，由教师自己选择开放给哪些组别
      const tids = ints(fd, "teacher").filter((id) => (db.prepare("SELECT role FROM users WHERE id=?").get(id) as any)?.role === "teacher");
      if (!tids.length) back(base(me.role), { err: "请至少勾选一位教师" });
      const insT = db.prepare("INSERT OR IGNORE INTO teacher_subjects VALUES (?,?)");
      let added = 0;
      db.transaction(() => { for (const tid of tids) for (const s of subjectIds) added += insT.run(tid, s).changes; })();
      if (!added) back(base(me.role), { err: "所选教师已经有这些学科了" });
      back(base(me.role), { ok: `已授权 ${tids.length} 位教师，他们可以在自己的「自由练习」页选择组别开放` });
    } else if (scope === "group") {
      const gs = ints(fd, "group");
      if (!gs.length) back(base(me.role), { err: "请至少勾选一个组别" });
      gs.forEach((g) => targets.push({ scope, org: null, group: g }));
    } else back(base(me.role), { err: "请选择开放范围" });
  } else {
    const gs = ints(fd, "group").filter((g) => (db.prepare("SELECT teacher_id FROM groups WHERE id=?").get(g) as any)?.teacher_id === me.id);
    if (!gs.length) back(base(me.role), { err: "请至少勾选一个组别" });
    gs.forEach((g) => targets.push({ scope: "group", org: null, group: g }));
  }
  let n = 0;
  db.transaction(() => {
    for (const s of subjectIds)
      for (const tg of targets)
        if (!exists.get(s, tg.scope, tg.org, tg.group)) { ins.run(s, tg.scope, tg.org, tg.group, me.id); n++; }
  })();
  if (!n) back(base(me.role), { err: "所选学科和范围已经开放过了" });
  back(base(me.role), { ok: `已开放 ${n} 项` });
}

/** admin 取消教师的某个学科授权（教师之前开放过的记录保留） */
export async function revokeTeacherSubject(fd: FormData) {
  await requireRole("admin");
  db.prepare("DELETE FROM teacher_subjects WHERE teacher_id=? AND subject_id=?").run(int(fd, "teacher_id"), int(fd, "subject_id"));
  back("/admin/practice", { ok: "已取消授权" });
}

export async function revokePractice(fd: FormData) {
  const me = await requireRole("admin", "teacher");
  const id = int(fd, "id");
  const g = db.prepare("SELECT p.*, gr.teacher_id FROM practice_grants p LEFT JOIN groups gr ON gr.id=p.group_id WHERE p.id=?").get(id) as any;
  if (!g || (me.role === "teacher" && !(g.scope === "group" && g.teacher_id === me.id))) back(base(me.role), { err: "无权操作" });
  db.prepare("DELETE FROM practice_grants WHERE id=?").run(id);
  back(base(me.role), { ok: "已关闭" });
}
