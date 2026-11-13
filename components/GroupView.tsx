import { notFound } from "next/navigation";
import { db } from "@/lib/db";

/** admin 只读查看组别成员 */
export default function GroupView({ id }: { id: number }) {
  const g = db.prepare("SELECT g.*, o.name org, t.name teacher FROM groups g JOIN orgs o ON o.id=g.org_id LEFT JOIN users t ON t.id=g.teacher_id WHERE g.id=?").get(id) as any;
  if (!g) notFound();
  const members = db.prepare("SELECT u.username, u.name FROM group_members m JOIN users u ON u.id=m.student_id WHERE m.group_id=? ORDER BY u.username").all(id) as any[];
  return (
    <>
      <div className="topbar">
        <h1>{g.name} <span className="muted small">（{g.org} · {g.teacher || "无教师"}）</span></h1>
        <a href="/admin/groups" className="btn btn-ghost">← 返回</a>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>用户名</th><th>姓名</th></tr></thead>
          <tbody>
            {members.map((m) => <tr key={m.username}><td>{m.username}</td><td>{m.name}</td></tr>)}
            {!members.length && <tr><td colSpan={2} className="muted">暂无成员</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
