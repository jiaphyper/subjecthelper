import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";

function count(sql: string) {
  return (db.prepare(sql).get() as { c: number }).c;
}

export default async function AdminHome() {
  const me = await requireRole("admin");
  const t = await getT();
  const row = db.prepare("SELECT password_hash FROM users WHERE id=?").get(me.id) as { password_hash: string };
  const defaultPw = bcrypt.compareSync("admin123", row.password_hash);
  const stats = [
    ["学校", count("SELECT COUNT(*) c FROM orgs")],
    ["教师", count("SELECT COUNT(*) c FROM users WHERE role='teacher'")],
    ["学生", count("SELECT COUNT(*) c FROM users WHERE role='student'")],
    ["组别", count("SELECT COUNT(*) c FROM groups")],
    ["学科", count("SELECT COUNT(*) c FROM subjects")],
    ["选择题", count("SELECT COUNT(*) c FROM mcq_questions")],
    ["词汇", count("SELECT COUNT(*) c FROM vocab")],
    ["填空套题", count("SELECT COUNT(*) c FROM cloze_sets")],
    ["任务", count("SELECT COUNT(*) c FROM tasks WHERE kind='task'")],
    ["学生自由练习", count("SELECT COUNT(*) c FROM tasks WHERE kind='practice'")],
  ] as const;
  return (
    <>
      <h1>{t("概览")}</h1>
      {defaultPw && (
        <div className="flash bad">
          {t("你仍在使用默认密码 admin123，请立即修改。")} <a href="/account">{t("去修改 →")}</a>
        </div>
      )}
      <div className="grid3">
        {stats.map(([k, v]) => (
          <div className="card" key={k}>
            <div className="muted small">{t(k)}</div>
            <div className="stat">{v}</div>
          </div>
        ))}
      </div>
    </>
  );
}
