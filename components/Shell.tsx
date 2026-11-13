import SideNav from "./SideNav";
import type { User } from "@/lib/db";

const ROLE_LABEL = { admin: "管理员", teacher: "教师", student: "学生" } as const;

export default function Shell({
  user,
  links,
  children,
}: {
  user: User;
  links: { href: string; label: string; exact?: boolean }[];
  children: React.ReactNode;
}) {
  return (
    <div className="shell">
      <nav className="side">
        <div className="brand">SubjectHelper</div>
        <div className="role">{ROLE_LABEL[user.role]}后台</div>
        <SideNav links={links} />
        <div className="grow" />
        <div className="me">{user.name}（{user.username}）</div>
        <a href="/account">修改密码</a>
        <a href="/logout">退出登录</a>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
