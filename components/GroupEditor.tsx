import { notFound } from "next/navigation";
import { db, User } from "@/lib/db";
import { saveGroup, deleteGroup } from "@/lib/groupActions";
import CheckAll from "./CheckAll";
import ConfirmButton from "./ConfirmButton";

export default function GroupEditor({ me, id, sp }: { me: User; id: number; sp: Record<string, string | undefined> }) {
  const isAdmin = me.role === "admin";
  const base = isAdmin ? "/admin/groups" : "/teacher/groups";
  const g = db.prepare("SELECT g.*, o.name org FROM groups g JOIN orgs o ON o.id=g.org_id WHERE g.id=?").get(id) as any;
  if (!g) notFound();
  if (!isAdmin && g.teacher_id !== me.id) notFound();

  const mine = sp.mine === "1";
  const q = sp.q || "";
  const viewerTeacher = isAdmin ? g.teacher_id ?? 0 : me.id;
  const students = db
    .prepare(
      `SELECT u.id, u.username, u.name,
         EXISTS(SELECT 1 FROM group_members m WHERE m.group_id=? AND m.student_id=u.id) member,
         EXISTS(SELECT 1 FROM teacher_students ts WHERE ts.teacher_id=? AND ts.student_id=u.id) bound,
         (SELECT GROUP_CONCAT(t.name, '、') FROM teacher_students ts JOIN users t ON t.id=ts.teacher_id WHERE ts.student_id=u.id) teachers
       FROM users u WHERE u.role='student' AND u.org_id=? AND u.active=1
         ${q ? "AND (u.username LIKE ? OR u.name LIKE ?)" : ""}
       ORDER BY member DESC, u.username`
    )
    .all(id, viewerTeacher, g.org_id, ...(q ? [`%${q}%`, `%${q}%`] : [])) as any[];
  const shown = mine ? students.filter((s) => s.bound || s.member) : students;
  const qs = new URLSearchParams(Object.entries({ mine: mine ? "1" : "", q }).filter(([, v]) => v)).toString();

  return (
    <>
      <div className="topbar">
        <h1>组别：{g.name} <span className="muted small">（{g.org}）</span></h1>
        <a href={base} className="btn btn-ghost">← 返回</a>
      </div>
      <form method="get" className="row card">
        <input type="text" name="q" defaultValue={q} placeholder="搜索学生" style={{ maxWidth: 220 }} />
        <label className="row" style={{ margin: 0 }}>
          <input type="checkbox" name="mine" value="1" defaultChecked={mine} /> 只显示{isAdmin ? "负责教师" : "我"}绑定的学生
        </label>
        <button className="btn-ghost">筛选</button>
      </form>
      <form action={saveGroup} className="card">
        <input type="hidden" name="id" value={g.id} />
        <input type="hidden" name="_qs" value={qs} />
        <div className="row" style={{ marginBottom: 12 }}>
          <div><label>组别名称</label><input type="text" name="name" defaultValue={g.name} /></div>
          <div style={{ alignSelf: "end" }}><CheckAll name="student" /></div>
          <div style={{ alignSelf: "end" }} className="right">
            <span className="muted small" style={{ marginRight: 10 }}>当前成员 {students.filter((s) => s.member).length} 人</span>
            <button>保存</button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th style={{ width: 40 }}>成员</th><th>用户名</th><th>姓名</th><th>绑定教师</th></tr></thead>
            <tbody>
              {shown.map((s) => (
                <tr key={s.id}>
                  <td>
                    <input type="hidden" name="shown" value={s.id} />
                    <input type="checkbox" name="student" value={s.id} defaultChecked={!!s.member} />
                  </td>
                  <td>{s.username}</td>
                  <td>{s.name} {!!s.bound && <span className="badge">{isAdmin ? "负责教师绑定" : "我的学生"}</span>}</td>
                  <td className="small muted">{s.teachers}</td>
                </tr>
              ))}
              {!shown.length && <tr><td colSpan={4} className="muted">本校没有符合条件的学生</td></tr>}
            </tbody>
          </table>
        </div>
      </form>
      <form action={deleteGroup}>
        <input type="hidden" name="id" value={g.id} />
        <ConfirmButton message={`删除组别「${g.name}」？`}>删除该组别</ConfirmButton>
      </form>
    </>
  );
}
