import SideNav from "./SideNav";
import type { User } from "@/lib/db";
import { getT } from "@/lib/i18n-server";
import { LangSwitch } from "./I18nProvider";

const ROLE_LABEL = { admin: "管理员后台", teacher: "教师后台", student: "学生" } as const;

export default async function Shell({
  user,
  links,
  children,
}: {
  user: User;
  links: { href: string; label: string; exact?: boolean }[];
  children: React.ReactNode;
}) {
  const t = await getT();
  return (
    <div className="shell">
      <nav className="side">
        <div className="brand">SubjectHelper</div>
        <div className="role">{t(ROLE_LABEL[user.role])}</div>
        <SideNav links={links.map((l) => ({ ...l, label: t(l.label) }))} />
        <div className="grow" />
        <div className="me">{user.name} ({user.username})</div>
        <a href="/account">{t("修改密码")}</a>
        <a href="/logout">{t("退出登录")}</a>
        <div className="side-lang"><LangSwitch className="dark" /></div>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
