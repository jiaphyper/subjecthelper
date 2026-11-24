import { db, User } from "@/lib/db";
import { createGroup } from "@/lib/groupActions";
import { getT } from "@/lib/i18n-server";

export default async function GroupList({ me }: { me: User }) {
  const t = await getT();
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
        <form action={createGroup} className="card row" data-tour="group-create">
          <input type="text" name="name" placeholder={t("新组别名称，如 G10-A")} style={{ maxWidth: 240 }} required />
          <button>{t("创建组别")}</button>
        </form>
      )}
      {isAdmin && <p className="muted small">{t("组别由教师自行创建和管理，这里仅供查看。")}</p>}
      <div className="table-wrap" data-tour="group-list">
        <table>
          <thead><tr><th>{t("组别")}</th>{isAdmin && <th>{t("学校")}</th>}<th>{t("教师")}</th><th>{t("人数")}</th><th></th></tr></thead>
          <tbody>
            {groups.map((g) => {
              return (
                <tr key={g.id}>
                  <td><b>{g.name}</b> </td>
                  {isAdmin && <td>{g.org}</td>}
                  <td>{g.teacher || <span className="muted">—</span>}</td>
                  <td>{g.n}</td>
                  <td><a href={`${base}/${g.id}`}>{isAdmin ? t("查看成员") : t("编辑成员")}</a></td>
                </tr>
              );
            })}
            {!groups.length && <tr><td colSpan={5} className="muted">{t("还没有组别")}</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
