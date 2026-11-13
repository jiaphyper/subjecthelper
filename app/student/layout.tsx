import { requireRole } from "@/lib/auth";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const me = await requireRole("student");
  return (
    <>
      <header className="stu-top">
        <a href="/student" className="brand" style={{ color: "#fff" }}>SubjectHelper</a>
        <a href="/student">我的任务</a>
        <span className="grow" />
        <span className="small">{me.name}</span>
        <a href="/account" className="small">修改密码</a>
        <a href="/logout" className="small">退出</a>
      </header>
      <main className="stu-main">{children}</main>
    </>
  );
}
