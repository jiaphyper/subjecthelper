import { db } from "./db";
import { hashPassword } from "./auth";
import { pick } from "./excel";

export interface ImportResult {
  created: number;
  updated: number;
  errors: string[];
  notes: string[];
}

const ROLE_MAP: Record<string, "student" | "teacher"> = {
  学生: "student", student: "student", 教师: "teacher", 老师: "teacher", teacher: "teacher",
};

export function importUsers(rows: Record<string, string>[], defaultOrgId: number | null): ImportResult {
  const res: ImportResult = { created: 0, updated: 0, errors: [], notes: [] };
  const parsed = rows.map((r, i) => ({
    line: i + 2,
    username: pick(r, "用户名", "username", "账号", "学号"),
    name: pick(r, "姓名", "name"),
    roleRaw: pick(r, "角色", "role"),
    password: pick(r, "密码", "password"),
    org: pick(r, "学校", "org", "organization"),
  }));

  const orgCache = new Map<string, number>();
  const getOrg = (name: string): number => {
    if (orgCache.has(name)) return orgCache.get(name)!;
    let row = db.prepare("SELECT id FROM orgs WHERE name=?").get(name) as { id: number } | undefined;
    if (!row) {
      const r = db.prepare("INSERT INTO orgs (name) VALUES (?)").run(name);
      row = { id: Number(r.lastInsertRowid) };
      res.notes.push(`新建学校：${name}`);
    }
    orgCache.set(name, row.id);
    return row.id;
  };
  const tx = db.transaction(() => {
    for (const p of parsed) {
      if (!p.username) {
        if (p.name || p.org) res.errors.push(`第 ${p.line} 行：缺少用户名`);
        continue;
      }
      const role = p.roleRaw ? ROLE_MAP[p.roleRaw.toLowerCase()] : "student";
      if (!role) {
        res.errors.push(`第 ${p.line} 行：角色「${p.roleRaw}」无效（应为 学生/教师）`);
        continue;
      }
      const orgId = p.org ? getOrg(p.org) : defaultOrgId;
      const existing = db.prepare("SELECT id, role, org_id FROM users WHERE username=?").get(p.username) as any;
      let userId: number;
      if (existing) {
        if (existing.role === "admin") {
          res.errors.push(`第 ${p.line} 行：${p.username} 是管理员账号，跳过`);
          continue;
        }
        db.prepare("UPDATE users SET name=COALESCE(NULLIF(?,''), name), role=?, org_id=COALESCE(?, org_id) WHERE id=?")
          .run(p.name, role, orgId, existing.id);
        if (p.password) db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(hashPassword(p.password), existing.id);
        userId = existing.id;
        res.updated++;
      } else {
        const r = db
          .prepare("INSERT INTO users (username, password_hash, name, role, org_id) VALUES (?,?,?,?,?)")
          .run(p.username, hashPassword(p.password || "123456"), p.name || p.username, role, orgId);
        userId = Number(r.lastInsertRowid);
        res.created++;
      }
    }
  });
  tx();
  return res;
}
