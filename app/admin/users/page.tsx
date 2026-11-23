import { db } from "@/lib/db";
import { requireRole, hashPassword } from "@/lib/auth";
import { str, int, back, SP } from "@/lib/util";
import Flash from "@/components/Flash";
import ConfirmButton from "@/components/ConfirmButton";
import { getT } from "@/lib/i18n-server";

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

async function setTeacherSubjects(fd: FormData) {
  "use server";
  await requireRole("admin");
  const id = int(fd, "id");
  const u = db.prepare("SELECT role FROM users WHERE id=?").get(id) as { role: string } | undefined;
  if (u?.role !== "teacher") back(listUrl(fd), { err: "只有教师可以设置学科" });
  const ids = fd.getAll("subject").map((v) => Number(v)).filter(Number.isFinite);
  db.transaction(() => {
    db.prepare("DELETE FROM teacher_subjects WHERE teacher_id=?").run(id);
    const ins = db.prepare("INSERT OR IGNORE INTO teacher_subjects VALUES (?,?)");
    ids.forEach((s) => ins.run(id, s));
  })();
  back(listUrl(fd), { ok: "已保存教师学科" });
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
  // 教师布置的任务会随账号级联删除（连同学生成绩），所以有任务的教师只允许停用
  const n = (db.prepare("SELECT COUNT(*) c FROM tasks WHERE teacher_id=? AND kind='task'").get(id) as { c: number }).c;
  if (n) back(listUrl(fd), { err: `该教师布置过 ${n} 个任务，删除会连同学生成绩一起删掉。请改用「停用」` });
  db.prepare("DELETE FROM users WHERE id=?").run(id);
  back(listUrl(fd), { ok: "已删除" });
}

export default async function UsersPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const t = await getT();
  const role = sp.role || "";
  const org = sp.org || "";
  const q = sp.q || "";
  const qs = new URLSearchParams(Object.entries({ role, org, q }).filter(([, v]) => v)).toString();

  const orgs = db.prepare("SELECT id, name FROM orgs ORDER BY name").all() as { id: number; name: string }[];
  const subjects = db.prepare("SELECT id, name FROM subjects ORDER BY name").all() as { id: number; name: string }[];
  const tsRows = db.prepare("SELECT teacher_id, subject_id FROM teacher_subjects").all() as { teacher_id: number; subject_id: number }[];
  const subjOf = (tid: number) => tsRows.filter((r) => r.teacher_id === tid).map((r) => r.subject_id);
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
        <h1>{t("账号管理")}</h1>
        <a className="btn btn-ghost" href="/admin/import">{t("批量导入 Excel")}</a>
      </div>
      <Flash ok={sp.ok} err={sp.err} />

      <details className="card">
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>{t("＋ 新建单个账号")}</summary>
        <form action={createUser} className="grid3" style={{ marginTop: 12 }}>
          <input type="hidden" name="_qs" value={qs} />
          <div><label>{t("用户名 *")}</label><input type="text" name="username" required /></div>
          <div><label>{t("姓名")}</label><input type="text" name="name" /></div>
          <div><label>{t(`初始密码（默认 ${DEFAULT_PW}）`)}</label><input type="text" name="password" /></div>
          <div>
            <label>{t("角色")}</label>
            <select name="role" defaultValue="student">
              <option value="student">{t("学生")}</option><option value="teacher">{t("教师")}</option><option value="admin">{t("管理员")}</option>
            </select>
          </div>
          <div>
            <label>{t("学校")}</label>
            <select name="org_id"><option value="">{t("（无）")}</option>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
          </div>
          <div style={{ alignSelf: "end" }}><button>{t("创建")}</button></div>
        </form>
      </details>

      <form className="row card" method="get">
        <select name="role" defaultValue={role} style={{ width: 120 }}>
          <option value="">{t("全部角色")}</option><option value="student">{t("学生")}</option><option value="teacher">{t("教师")}</option><option value="admin">{t("管理员")}</option>
        </select>
        <select name="org" defaultValue={org} style={{ width: 200 }}>
          <option value="">{t("全部学校")}</option><option value="none">{t("（未分配学校）")}</option>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <input type="text" name="q" defaultValue={q} placeholder={t("搜索用户名/姓名")} style={{ width: 220 }} />
        <button className="btn-ghost">{t("筛选")}</button>
        <span className="muted small right">{t(`共 ${users.length} 个`)}{users.length >= 500 ? t("（仅显示前 500）") : ""}</span>
      </form>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>{t("用户名")}</th><th>{t("姓名 / 学校")}</th><th>{t("角色")}</th><th>{t("绑定教师 / 组别 / 学科")}</th><th>{t("重置密码")}</th><th>{t("状态")}</th><th></th></tr>
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
                      <option value="">{t("（无）")}</option>
                      {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                    <button className="btn-ghost btn-sm">{t("保存")}</button>
                  </form>
                </td>
                <td><span className={"badge " + (u.role === "admin" ? "warn" : u.role === "teacher" ? "" : "gray")}>{t(ROLE[u.role])}</span></td>
                <td className="small">
                  {u.role === "student" && (
                    <>
                      <div>{u.teachers || <span className="muted">{t("未绑定教师")}</span>}</div>
                      <div className="muted">{u.grps || ""}</div>
                    </>
                  )}
                  {u.role === "teacher" && (() => {
                    const mine = subjOf(u.id);
                    return (
                      <>
                        <div>{t(`已绑定 ${u.bound} 名学生`)}</div>
                        <details className="subj-edit">
                          <summary>
                            {mine.length
                              ? subjects.filter((s) => mine.includes(s.id)).map((s) => <span key={s.id} className="badge" style={{ marginRight: 4 }}>{s.name}</span>)
                              : <span className="badge warn">{t("未设置学科")}</span>}
                            <span className="subj-edit-link">{t("设置学科")}</span>
                          </summary>
                          <form action={setTeacherSubjects} className="subj-edit-form">
                            <input type="hidden" name="id" value={u.id} />
                            <input type="hidden" name="_qs" value={qs} />
                            {subjects.map((s) => (
                              <label key={s.id}><input type="checkbox" name="subject" value={s.id} defaultChecked={mine.includes(s.id)} /> {s.name}</label>
                            ))}
                            {!subjects.length && <span className="muted">{t("还没有学科")}</span>}
                            <button className="btn-sm">{t("保存")}</button>
                          </form>
                        </details>
                      </>
                    );
                  })()}
                </td>
                <td>
                  <form action={resetPassword} className="inline-form">
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="_qs" value={qs} />
                    <input type="text" name="password" placeholder={DEFAULT_PW} style={{ width: 80 }} />
                    <ConfirmButton message={t(`重置 ${u.username} 的密码？`)} className="btn-ghost btn-sm">{t("重置")}</ConfirmButton>
                  </form>
                </td>
                <td>
                  <form action={toggleActive} className="inline-form">
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="_qs" value={qs} />
                    <button className="btn-ghost btn-sm">{u.active ? t("停用") : t("启用")}</button>
                  </form>
                </td>
                <td>
                  <form action={deleteUser} className="inline-form">
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="_qs" value={qs} />
                    <ConfirmButton message={t(`删除账号 ${u.username}？其成绩记录也会删除。`)}>{t("删除")}</ConfirmButton>
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
