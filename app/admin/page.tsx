import { db } from "@/lib/db";

function count(sql: string) {
  return (db.prepare(sql).get() as { c: number }).c;
}

export default function AdminHome() {
  const stats = [
    ["学校", count("SELECT COUNT(*) c FROM orgs")],
    ["教师", count("SELECT COUNT(*) c FROM users WHERE role='teacher'")],
    ["学生", count("SELECT COUNT(*) c FROM users WHERE role='student'")],
    ["组别", count("SELECT COUNT(*) c FROM groups")],
    ["学科", count("SELECT COUNT(*) c FROM subjects")],
    ["选择题", count("SELECT COUNT(*) c FROM mcq_questions")],
    ["词汇", count("SELECT COUNT(*) c FROM vocab")],
    ["填空套题", count("SELECT COUNT(*) c FROM cloze_sets")],
    ["任务", count("SELECT COUNT(*) c FROM tasks")],
  ] as const;
  return (
    <>
      <h1>概览</h1>
      <div className="grid3">
        {stats.map(([k, v]) => (
          <div className="card" key={k}>
            <div className="muted small">{k}</div>
            <div className="stat">{v}</div>
          </div>
        ))}
      </div>
    </>
  );
}
