import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { str, int, back, SP } from "@/lib/util";
import Flash from "@/components/Flash";
import ConfirmButton from "@/components/ConfirmButton";

async function createSubject(fd: FormData) {
  "use server";
  await requireRole("admin");
  const name = str(fd, "name");
  if (!name) back("/admin/subjects", { err: "请输入学科名称" });
  try {
    db.prepare("INSERT INTO subjects (name) VALUES (?)").run(name);
  } catch {
    back("/admin/subjects", { err: "学科已存在" });
  }
  back("/admin/subjects", { ok: `已创建：${name}` });
}
async function renameSubject(fd: FormData) {
  "use server";
  await requireRole("admin");
  db.prepare("UPDATE subjects SET name=? WHERE id=?").run(str(fd, "name"), int(fd, "id"));
  back("/admin/subjects", { ok: "已保存" });
}
async function deleteSubject(fd: FormData) {
  "use server";
  await requireRole("admin");
  const id = int(fd, "id");
  const used = db.prepare("SELECT COUNT(*) c FROM tasks WHERE subject_id=?").get(id) as { c: number };
  if (used.c) back("/admin/subjects", { err: "该学科已有任务，不能删除" });
  db.prepare("DELETE FROM subjects WHERE id=?").run(id);
  back("/admin/subjects", { ok: "已删除" });
}

export default async function SubjectsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const rows = db
    .prepare(
      `SELECT s.*,
        (SELECT COUNT(*) FROM mcq_questions q WHERE q.subject_id=s.id) mcq,
        (SELECT COUNT(*) FROM vocab v WHERE v.subject_id=s.id) vocab,
        (SELECT COUNT(*) FROM cloze_sets c WHERE c.subject_id=s.id) cloze
       FROM subjects s ORDER BY s.name`
    )
    .all() as any[];
  return (
    <>
      <h1>学科</h1>
      <Flash ok={sp.ok} err={sp.err} />
      <form action={createSubject} className="card row">
        <input type="text" name="name" placeholder="如：English、Physics、Chemistry" style={{ maxWidth: 320 }} />
        <button>添加学科</button>
      </form>
      <div className="table-wrap">
        <table>
          <thead><tr><th>学科</th><th>选择题</th><th>词汇</th><th>填空套题</th><th></th></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>
                  <form action={renameSubject} className="inline-form">
                    <input type="hidden" name="id" value={s.id} />
                    <input type="text" name="name" defaultValue={s.name} />
                    <button className="btn-ghost btn-sm">保存</button>
                  </form>
                </td>
                <td>{s.mcq}</td><td>{s.vocab}</td><td>{s.cloze}</td>
                <td>
                  <form action={deleteSubject} className="inline-form">
                    <input type="hidden" name="id" value={s.id} />
                    <ConfirmButton message={`删除学科「${s.name}」及其全部题目？`}>删除</ConfirmButton>
                  </form>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="muted">还没有学科</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
