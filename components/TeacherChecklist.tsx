import { db, User } from "@/lib/db";
import { getT } from "@/lib/i18n-server";
import { TourLauncher } from "./Tour";

/** 教师首页「开始使用」清单：按实际数据打勾，全部完成后自动隐藏 */
export default async function TeacherChecklist({ me }: { me: User }) {
  const t = await getT();
  const c = (sql: string, ...a: any[]) => (db.prepare(sql).get(...a) as { c: number }).c;
  const groups = c("SELECT COUNT(*) c FROM groups WHERE teacher_id=?", me.id);
  const members = c("SELECT COUNT(*) c FROM group_members m JOIN groups g ON g.id=m.group_id WHERE g.teacher_id=?", me.id);
  const bound = c("SELECT COUNT(*) c FROM teacher_students WHERE teacher_id=?", me.id);
  const tasks = c("SELECT COUNT(*) c FROM tasks WHERE teacher_id=? AND kind='task'", me.id);
  const firstGroup = (db.prepare("SELECT id FROM groups WHERE teacher_id=? ORDER BY id LIMIT 1").get(me.id) as { id: number } | undefined)?.id;
  const items = [
    { done: groups > 0, title: t("创建组别"), desc: t("你的班级或学生小组，任务按组别发布"), href: "/teacher/groups", cta: t("去创建") },
    { done: members > 0, title: t("把学生加入组别"), desc: t("在组别里勾选本校学生"), href: firstGroup ? `/teacher/groups/${firstGroup}` : "/teacher/groups", cta: t("去添加") },
    { done: tasks > 0, title: t("布置第一个任务"), desc: t("选题型、数量和组别，一键发布"), href: "/teacher/tasks/new", cta: t("去布置") },
    { done: bound > 0, title: t("（可选）绑定我的学生"), desc: t("方便只看自己的学生"), href: "/teacher/students?tab=bind", cta: t("去绑定"), optional: true },
  ];
  const required = items.filter((i) => !i.optional);
  const doneN = required.filter((i) => i.done).length;
  if (doneN === required.length) return null;
  const next = items.find((i) => !i.done && !i.optional);
  return (
    <div className="card checklist-card">
      <div className="row">
        <div>
          <h2 style={{ margin: 0 }}>{t("开始使用")}</h2>
          <div className="small muted">{t(`完成 ${doneN} / ${required.length} 步，就可以给学生布置作业了`)}</div>
        </div>
        <span className="right small"><TourLauncher /></span>
      </div>
      {!me.org_id && <div className="flash bad" style={{ marginTop: 12 }}>{t("你的账号还没有分配学校，暂时不能创建组别，请联系管理员。")}</div>}
      <div className="cl-progress"><i style={{ width: `${(doneN / required.length) * 100}%` }} /></div>
      <ol className="cl-list">
        {items.map((i, n) => (
          <li key={n} className={(i.done ? "done" : "") + (i === next ? " next" : "") + (i.optional ? " optional" : "")}>
            <span className="cl-dot">{i.done ? "✓" : i.optional ? "·" : n + 1}</span>
            <div className="cl-text"><b>{i.title}</b><span>{i.desc}</span></div>
            {!i.done && <a className={"btn btn-sm " + (i === next ? "" : "btn-ghost")} href={i.href}>{i.cta}</a>}
          </li>
        ))}
      </ol>
    </div>
  );
}
