import { db, User } from "@/lib/db";
import { createGroup } from "@/lib/groupActions";

export default function GroupList({ me }: { me: User }) {
  const isAdmin = me.role === "admin";
  const base = isAdmin ? "/admin/groups" : "/teacher/groups";
  const groups = db
    .prepare(
      `SELECT g.*, o.name org, t.name teacher,
        (SELECT COUNT(*) FROM group_members m WHERE m.group_id=g.id) n
       FROM groups g JOIN orgs o ON o.id=g.org_id LEFT JOIN users t ON t.id=g.teacher_id
       ${isAdmin ? "" : "WHERE g.teacher_id = ?"}
       ORDER BY o.name, g.name`
    )
    .all(...(isAdmin ? [] : [me.id])) as any[];
  return (
    <>
      {!isAdmin && (
        <form action={createGroup} className="card row">
          <input type="text" name="name" placeholder="新组别名称，如 G10-A" style={{ maxWidth: 240 }} required />
          <button>创建组别</button>
        </form>
      )}
      {isAdmin && <p className="muted small">组别由教师自行创建和管理，这里仅供查看。</p>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>组别</th>{isAdmin && <th>学校</th>}<th>教师</th><th>人数</th><th></th></tr></thead>
          <tbody>
            {groups.map((g) => {
              return (
                <tr key={g.id}>
                  <td><b>{g.name}</b> </td>
                  {isAdmin && <td>{g.org}</td>}
                  <td>{g.teacher || <span className="muted">—</span>}</td>
                  <td>{g.n}</td>
                  <td><a href={`${base}/${g.id}`}>{isAdmin ? "查看成员" : "编辑成员"}</a></td>
                </tr>
              );
            })}
            {!groups.length && <tr><td colSpan={5} className="muted">还没有组别</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
