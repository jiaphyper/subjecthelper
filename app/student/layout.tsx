import { requireRole } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { practiceSubjectIds } from "@/lib/practice";
import { LangSwitch } from "@/components/I18nProvider";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const me = await requireRole("student");
  const t = await getT();
  const canPractice = practiceSubjectIds(me).length > 0;
  return (
    <>
      <header className="stu-top">
        <a href="/student" className="brand" style={{ color: "#fff" }}>SubjectHelper</a>
        <nav className="stu-nav">
          <a href="/student">{t("我的任务")}</a>
          {canPractice && <a href="/student/practice">{t("自由练习")}</a>}
        </nav>
        <span className="grow" />
        <span className="small stu-name">{me.name}</span>
        <a href="/account" className="small">{t("修改密码")}</a>
        <a href="/logout" className="small">{t("退出")}</a>
        <LangSwitch className="dark" />
      </header>
      <main className="stu-main">{children}</main>
    </>
  );
}
