"use server";
import { db } from "./db";
import { requireRole } from "./auth";
import { str, int, ints, back } from "./util";

const base = (role: string) => (role === "admin" ? "/admin/practice" : "/teacher/practice");

/** 开放自由练习：admin 可开放给全部学生 / 某学校 / 某组别；教师只能开放给自己的组别 */
export async function grantPractice(fd: FormData) {
  const me = await requireRole("admin", "teacher");
  const subjectIds = ints(fd, "subject");
  if (!subjectIds.length) back(base(me.role), { err: "请至少选择一个学科" });
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
  back(base(me.role), { ok: `已开放 ${n} 项` });
}

export async function revokePractice(fd: FormData) {
  const me = await requireRole("admin", "teacher");
  const id = int(fd, "id");
  const g = db.prepare("SELECT p.*, gr.teacher_id FROM practice_grants p LEFT JOIN groups gr ON gr.id=p.group_id WHERE p.id=?").get(id) as any;
  if (!g || (me.role === "teacher" && !(g.scope === "group" && g.teacher_id === me.id))) back(base(me.role), { err: "无权操作" });
  db.prepare("DELETE FROM practice_grants WHERE id=?").run(id);
  back(base(me.role), { ok: "已关闭" });
}
