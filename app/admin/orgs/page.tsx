import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { str, int, back, SP } from "@/lib/util";
import Flash from "@/components/Flash";
import ConfirmButton from "@/components/ConfirmButton";
import { getT } from "@/lib/i18n-server";

async function createOrg(fd: FormData) {
  "use server";
  await requireRole("admin");
  const name = str(fd, "name");
  if (!name) back("/admin/orgs", { err: "请输入学校名称" });
  try {
    db.prepare("INSERT INTO orgs (name) VALUES (?)").run(name);
  } catch {
    back("/admin/orgs", { err: "学校已存在" });
  }
  back("/admin/orgs", { ok: `已创建：${name}` });
}
async function renameOrg(fd: FormData) {
  "use server";
  await requireRole("admin");
  db.prepare("UPDATE orgs SET name=? WHERE id=?").run(str(fd, "name"), int(fd, "id"));
  back("/admin/orgs", { ok: "已保存" });
}
async function deleteOrg(fd: FormData) {
  "use server";
  await requireRole("admin");
  db.prepare("DELETE FROM orgs WHERE id=?").run(int(fd, "id"));
  back("/admin/orgs", { ok: "已删除" });
}

export default async function OrgsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const t = await getT();
  const orgs = db
    .prepare(
      `SELECT o.*,
        (SELECT COUNT(*) FROM users u WHERE u.org_id=o.id AND u.role='teacher') teachers,
        (SELECT COUNT(*) FROM users u WHERE u.org_id=o.id AND u.role='student') students,
        (SELECT COUNT(*) FROM groups g WHERE g.org_id=o.id) groups
       FROM orgs o ORDER BY o.name`
    )
    .all() as any[];
  return (
    <>
      <h1>{t("学校")}</h1>
      <Flash ok={sp.ok} err={sp.err} />
      <form action={createOrg} className="card row">
        <input type="text" name="name" placeholder={t("新学校名称")} style={{ maxWidth: 320 }} />
        <button>{t("添加学校")}</button>
      </form>
      <div className="table-wrap">
        <table>
          <thead><tr><th>{t("名称")}</th><th>{t("教师")}</th><th>{t("学生")}</th><th>{t("组别")}</th><th></th></tr></thead>
          <tbody>
            {orgs.map((o) => (
              <tr key={o.id}>
                <td>
                  <form action={renameOrg} className="inline-form">
                    <input type="hidden" name="id" value={o.id} />
                    <input type="text" name="name" defaultValue={o.name} />
                    <button className="btn-ghost btn-sm">{t("保存")}</button>
                  </form>
                </td>
                <td>{o.teachers}</td><td>{o.students}</td><td>{o.groups}</td>
                <td>
                  <form action={deleteOrg} className="inline-form">
                    <input type="hidden" name="id" value={o.id} />
                    <ConfirmButton message={t(`删除学校「${o.name}」？其下组别会一并删除，账号保留但不再属于任何学校。`)}>{t("删除")}</ConfirmButton>
                  </form>
                </td>
              </tr>
            ))}
            {!orgs.length && <tr><td colSpan={5} className="muted">{t("还没有学校")}</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
