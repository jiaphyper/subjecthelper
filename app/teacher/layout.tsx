import Shell from "@/components/Shell";
import { requireRole } from "@/lib/auth";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("teacher");
  return (
    <Shell
      user={user}
      links={[
        { href: "/teacher", label: "我的任务", exact: true },
        { href: "/teacher/tasks/new", label: "布置任务" },
        { href: "/teacher/groups", label: "组别" },
        { href: "/teacher/students", label: "我的学生" },
      ]}
    >
      {children}
    </Shell>
  );
}
