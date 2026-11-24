import Shell from "@/components/Shell";
import Tour, { TEACHER_STEPS } from "@/components/Tour";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("teacher");
  const onboarded = !!(db.prepare("SELECT onboarded FROM users WHERE id=?").get(user.id) as { onboarded: number } | undefined)?.onboarded;
  return (
    <Shell
      user={user}
      links={[
        { href: "/teacher", label: "我的任务", exact: true },
        { href: "/teacher/tasks/new", label: "布置任务" },
        { href: "/teacher/groups", label: "组别" },
        { href: "/teacher/students", label: "我的学生" },
        { href: "/teacher/practice", label: "自由练习" },
      ]}
    >
      {children}
      <Tour steps={TEACHER_STEPS} storageKey={`sh_tour_teacher_${user.id}`} onboarded={onboarded} />
    </Shell>
  );
}
