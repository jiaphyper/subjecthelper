"use server";
import { db } from "./db";
import { requireRole } from "./auth";
import { str, int, ints, back } from "./util";

async function canEdit(groupId: number) {
  const me = await requireRole("teacher");
  const g = db.prepare("SELECT * FROM groups WHERE id=?").get(groupId) as any;
  if (!g) throw new Error("组别不存在");
  if (g.teacher_id !== me.id)
    throw new Error("无权修改该组别");
  return { me, g };
}

const base = (role: string) => (role === "admin" ? "/admin/groups" : "/teacher/groups");

export async function createGroup(fd: FormData) {
  const me = await requireRole("teacher");
  const name = str(fd, "name");
  const orgId = me.org_id;
  const teacherId = me.id;
  if (!name) back(base(me.role), { err: "请输入组别名称" });
  if (!orgId) back(base(me.role), { err: "你的账号还没有分配学校，请联系管理员" });
  const r = db.prepare("INSERT INTO groups (name, org_id, teacher_id) VALUES (?,?,?)").run(name, orgId, teacherId);
  back(`${base(me.role)}/${r.lastInsertRowid}`, { ok: `已创建组别「${name}」，请勾选成员` });
}

export async function saveGroup(fd: FormData) {
  const id = int(fd, "id")!;
  const { me, g } = await canEdit(id);
  const name = str(fd, "name") || g.name;
  const teacherId = g.teacher_id;
  const shown = ints(fd, "shown");
  const checked = new Set(ints(fd, "student"));
  const tx = db.transaction(() => {
    db.prepare("UPDATE groups SET name=?, teacher_id=? WHERE id=?").run(name, teacherId, id);
    for (const sid of shown) {
      const isStudent = db.prepare("SELECT 1 FROM users WHERE id=? AND role='student' AND org_id=?").get(sid, g.org_id);
      if (checked.has(sid) && isStudent) db.prepare("INSERT OR IGNORE INTO group_members VALUES (?,?)").run(id, sid);
      else db.prepare("DELETE FROM group_members WHERE group_id=? AND student_id=?").run(id, sid);
    }
  });
  tx();
  back(`${base(me.role)}/${id}${str(fd, "_qs") ? "?" + str(fd, "_qs") : ""}`, { ok: "已保存" });
}

export async function deleteGroup(fd: FormData) {
  const id = int(fd, "id")!;
  const { me } = await canEdit(id);
  db.prepare("DELETE FROM groups WHERE id=?").run(id);
  back(base(me.role), { ok: "已删除组别" });
}
