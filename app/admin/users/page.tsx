import { db } from "@/lib/db";
import { requireRole, hashPassword } from "@/lib/auth";
import { str, int, back, SP } from "@/lib/util";
import Flash from "@/components/Flash";
import ConfirmButton from "@/components/ConfirmButton";

const ROLE = { admin: "管理员", teacher: "教师", student: "学生" } as Record<string, string>;
const DEFAULT_PW = "123456";

function listUrl(fd: FormData) {
  return "/admin/users" + (str(fd, "_qs") ? "?" + str(fd, "_qs") : "");
}

async function createUser(fd: FormData) {
  "use server";
  await requireRole("admin");
  const username = str(fd, "username");
  const name = str(fd, "name") || username;
  const role = str(fd, "role");
  const orgId = int(fd, "org_id");
  const pw = str(fd, "password") || DEFAULT_PW;
  if (!username) back(listUrl(fd), { err: "请输入用户名" });
  if (!["admin", "teacher", "student"].includes(role)) back(listUrl(fd), { err: "角色无效" });
  try {
    db.prepare("INSERT INTO users (username, password_hash, name, role, org_id) VALUES (?,?,?,?,?)")
      .run(username, hashPassword(pw), name, role, orgId);
  } catch {
    back(listUrl(fd), { err: `用户名 ${username} 已存在` });
  }
  back(listUrl(fd), { ok: `已创建 ${ROLE[role]}：${username}，初始密码 ${pw}` });
}

async function updateUser(fd: FormData) {
  "use server";
  await requireRole("admin");
  const id = int(fd, "id");
  db.prepare("UPDATE users SET name=?, org_id=? WHERE id=?").run(str(fd, "name"), int(fd, "org_id"), id);
  back(listUrl(fd), { ok: "已保存" });
}

async function resetPassword(fd: FormData) {
  "use server";
  await requireRole("admin");
  const pw = str(fd, "password") || DEFAULT_PW;
  db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(hashPassword(pw), int(fd, "id"));
  db.prepare("DELETE FROM sessions WHERE user_id=?").run(int(fd, "id"));
  back(listUrl(fd), { ok: `密码已重置为 ${pw}` });
}

async function toggleActive(fd: FormData) {
  "use server";
  const me = await requireRole("admin");
  const id = int(fd, "id");
  if (id === me.id) back(listUrl(fd), { err: "不能停用自己" });
  db.prepare("UPDATE users SET active = 1 - active WHERE id=?").run(id);
  db.prepare("DELETE FROM sessions WHERE user_id=?").run(id);
  back(listUrl(fd), { ok: "已更新状态" });
}

async function deleteUser(fd: FormData) {
  "use server";
  const me = await requireRole("admin");
  const id = int(fd, "id");
  if (id === me.id) back(listUrl(fd), { err: "不能删除自己" });
  db.prepare("DELETE FROM users WHERE id=?").run(id);
  back(listUrl(fd), { ok: "已删除" });
}

export default async function UsersPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const role = sp.role || "";
  const org = sp.org || "";
  const q = sp.q || "";
  const qs = new URLSearchParams(Object.entries({ role, org, q }).filter(([, v]) => v)).toString();

  const orgs = db.prepare("SELECT id, name FROM orgs ORDER BY name").all() as { id: number; name: string }[];
  const where: string[] = [];
  const args: any[] = [];
  if (role) { where.push("u.role = ?"); args.push(role); }
  if (org === "none") where.push("u.org_id IS NULL");
  else if (org) { where.push("u.org_id = ?"); args.push(Number(org)); }
  if (q) { where.push("(u.username LIKE ? OR u.name LIKE ?)"); args.push(`%${q}%`, `%${q}%`); }
  const users = db
    .prepare(
      `SELECT u.*, o.name org_name,
         (SELECT GROUP_CONCAT(t.name, '、') FROM teacher_students ts JOIN users t ON t.id=ts.teacher_id WHERE ts.student_id=u.id) teachers,
         (SELECT GROUP_CONCAT(g.name, '、') FROM group_members gm JOIN groups g ON g.id=gm.group_id WHERE gm.student_id=u.id) grps,
         (SELECT COUNT(*) FROM teacher_students ts WHERE ts.teacher_id=u.id) bound
       FROM users u LEFT JOIN orgs o ON o.id=u.org_id
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY u.role, o.name, u.username LIMIT 500`
    )
    .all(...args) as any[];

  return (
    <>
      <div className="topbar">
        <h1>账号管理</h1>
        <a className="btn btn-ghost" href="/admin/import">批量导入 Excel</a>
      </div>
      <Flash ok={sp.ok} err={sp.err} />

      <details className="card">
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>＋ 新建单个账号</summary>
        <form action={createUser} className="grid3" style={{ marginTop: 12 }}>
          <input type="hidden" name="_qs" value={qs} />
          <div><label>用户名 *</label><input type="text" name="username" required /></div>
          <div><label>姓名</label><input type="text" name="name" /></div>
          <div><label>初始密码（默认 {DEFAULT_PW}）</label><input type="text" name="password" /></div>
          <div>
            <label>角色</label>
            <select name="role" defaultValue="student">
              <option value="student">学生</option><option value="teacher">教师</option><option value="admin">管理员</option>
            </select>
          </div>
          <div>
            <label>学校</label>
            <select name="org_id"><option value="">（无）</option>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
          </div>
          <div style={{ alignSelf: "end" }}><button>创建</button></div>
        </form>
      </details>

      <form className="row card" method="get">
        <select name="role" defaultValue={role} style={{ width: 120 }}>
          <option value="">全部角色</option><option value="student">学生</option><option value="teacher">教师</option><option value="admin">管理员</option>
        </select>
        <select name="org" defaultValue={org} style={{ width: 200 }}>
          <option value="">全部学校</option><option value="none">（未分配学校）</option>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <input type="text" name="q" defaultValue={q} placeholder="搜索用户名/姓名" style={{ width: 220 }} />
        <button className="btn-ghost">筛选</button>
        <span className="muted small right">共 {users.length} 个{users.length >= 500 ? "（仅显示前 500）" : ""}</span>
      </form>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>用户名</th><th>姓名 / 学校</th><th>角色</th><th>绑定教师 / 组别</th><th>重置密码</th><th>状态</th><th></th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={u.active ? {} : { opacity: 0.55 }}>
                <td><b>{u.username}</b></td>
                <td>
                  <form action={updateUser} className="inline-form">
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="_qs" value={qs} />
                    <input type="text" name="name" defaultValue={u.name} style={{ width: 100 }} />
                    <select name="org_id" defaultValue={u.org_id ?? ""} style={{ width: 130 }}>
                      <option value="">（无）</option>
                      {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                    <button className="btn-ghost btn-sm">保存</button>
                  </form>
                </td>
                <td><span className={"badge " + (u.role === "admin" ? "warn" : u.role === "teacher" ? "" : "gray")}>{ROLE[u.role]}</span></td>
                <td className="small">
                  {u.role === "student" && (
                    <>
                      <div>{u.teachers || <span className="muted">未绑定教师</span>}</div>
                      <div className="muted">{u.grps || ""}</div>
                    </>
                  )}
                  {u.role === "teacher" && <span>已绑定 {u.bound} 名学生</span>}
                </td>
                <td>
                  <form action={resetPassword} className="inline-form">
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="_qs" value={qs} />
                    <input type="text" name="password" placeholder={DEFAULT_PW} style={{ width: 80 }} />
                    <ConfirmButton message={`重置 ${u.username} 的密码？`} className="btn-ghost btn-sm">重置</ConfirmButton>
                  </form>
                </td>
                <td>
                  <form action={toggleActive} className="inline-form">
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="_qs" value={qs} />
                    <button className="btn-ghost btn-sm">{u.active ? "停用" : "启用"}</button>
                  </form>
                </td>
                <td>
                  <form action={deleteUser} className="inline-form">
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="_qs" value={qs} />
                    <ConfirmButton message={`删除账号 ${u.username}？其成绩记录也会删除。`}>删除</ConfirmButton>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
