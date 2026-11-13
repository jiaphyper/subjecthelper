import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { ints, str, back, SP } from "@/lib/util";
import Flash from "@/components/Flash";
import CheckAll from "@/components/CheckAll";

async function saveBindings(fd: FormData) {
  "use server";
  const me = await requireRole("teacher");
  const shown = ints(fd, "shown");
  const checked = new Set(ints(fd, "student"));
  const sameOrg = db.prepare("SELECT 1 FROM users WHERE id=? AND role='student' AND org_id=?");
  db.transaction(() => {
    for (const sid of shown) {
      if (checked.has(sid) && sameOrg.get(sid, me.org_id)) db.prepare("INSERT OR IGNORE INTO teacher_students VALUES (?,?)").run(me.id, sid);
      else if (!checked.has(sid)) db.prepare("DELETE FROM teacher_students WHERE teacher_id=? AND student_id=?").run(me.id, sid);
    }
  })();
  back("/teacher/students?tab=bind" + (str(fd, "q") ? "&q=" + encodeURIComponent(str(fd, "q")) : ""), { ok: "绑定已保存" });
}

export default async function MyStudents({ searchParams }: { searchParams: SP }) {
  const me = await requireRole("teacher");
  const sp = await searchParams;
  const tab = sp.tab === "bind" ? "bind" : "list";
  const q = sp.q || "";
  if (!me.org_id) return (<><h1>我的学生</h1><div className="flash bad">你的账号还没有分配学校，请联系管理员。</div></>);

  return (
    <>
      <h1>我的学生</h1>
      <Flash ok={sp.ok} err={sp.err} />
      <div className="tabs">
        <a href="/teacher/students" className={tab === "list" ? "active" : ""}>已绑定的学生</a>
        <a href="/teacher/students?tab=bind" className={tab === "bind" ? "active" : ""}>绑定 / 解绑学生</a>
      </div>
      {tab === "list" ? <BoundList teacherId={me.id} /> : <BindForm teacherId={me.id} orgId={me.org_id} q={q} />}
    </>
  );
}

function BoundList({ teacherId }: { teacherId: number }) {
  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.name,
        (SELECT GROUP_CONCAT(g.name, '、') FROM group_members m JOIN groups g ON g.id=m.group_id WHERE m.student_id=u.id AND g.teacher_id=?) grps,
        (SELECT COUNT(*) FROM task_students ts JOIN tasks t ON t.id=ts.task_id WHERE ts.student_id=u.id AND t.teacher_id=?) tasks,
        (SELECT COUNT(DISTINCT a.task_id) FROM attempts a JOIN tasks t ON t.id=a.task_id WHERE a.student_id=u.id AND t.teacher_id=?) done,
        (SELECT AVG(best) FROM (SELECT MAX(a.score*100.0/MAX(a.total,1)) best FROM attempts a JOIN tasks t ON t.id=a.task_id WHERE a.student_id=u.id AND t.teacher_id=? GROUP BY a.task_id)) avg
       FROM teacher_students ts JOIN users u ON u.id=ts.student_id
       WHERE ts.teacher_id=? AND u.active=1 ORDER BY u.username`
    )
    .all(teacherId, teacherId, teacherId, teacherId, teacherId) as any[];
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>用户名</th><th>姓名</th><th>我的组别</th><th>完成任务</th><th>平均最高分</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.username}</td><td><b>{r.name}</b></td><td className="small">{r.grps || <span className="muted">—</span>}</td>
              <td>{r.done} / {r.tasks}</td><td>{r.avg == null ? <span className="muted">—</span> : Math.round(r.avg) + "%"}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={5} className="muted">还没有绑定学生，点「绑定 / 解绑学生」从本校学生中选择</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function BindForm({ teacherId, orgId, q }: { teacherId: number; orgId: number; q: string }) {
  const students = db
    .prepare(
      `SELECT u.id, u.username, u.name,
        EXISTS(SELECT 1 FROM teacher_students ts WHERE ts.teacher_id=? AND ts.student_id=u.id) bound
       FROM users u WHERE u.role='student' AND u.org_id=? AND u.active=1
       ${q ? "AND (u.username LIKE ? OR u.name LIKE ?)" : ""} ORDER BY bound DESC, u.username`
    )
    .all(teacherId, orgId, ...(q ? [`%${q}%`, `%${q}%`] : [])) as any[];
  return (
    <>
      <form method="get" className="row card">
        <input type="hidden" name="tab" value="bind" />
        <input type="text" name="q" defaultValue={q} placeholder="搜索本校学生" style={{ maxWidth: 240 }} />
        <button className="btn-ghost">搜索</button>
      </form>
      <form action={saveBindings} className="card">
        <input type="hidden" name="q" value={q} />
        <div className="row" style={{ marginBottom: 10 }}>
          <span className="muted small">本校学生 {students.length} 人，已绑定 {students.filter((s) => s.bound).length} 人</span>
          <CheckAll name="student" />
          <button className="right">保存绑定</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th style={{ width: 40 }}></th><th>用户名</th><th>姓名</th></tr></thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td><input type="hidden" name="shown" value={s.id} /><input type="checkbox" name="student" value={s.id} defaultChecked={!!s.bound} /></td>
                  <td>{s.username}</td><td>{s.name}</td>
                </tr>
              ))}
              {!students.length && <tr><td colSpan={3} className="muted">没有找到学生</td></tr>}
            </tbody>
          </table>
        </div>
      </form>
    </>
  );
}
