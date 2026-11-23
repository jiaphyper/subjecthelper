import Shell from "@/components/Shell";
import { requireRole } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("admin");
  return (
    <Shell
      user={user}
      links={[
        { href: "/admin", label: "概览", exact: true },
        { href: "/admin/orgs", label: "学校" },
        { href: "/admin/users", label: "账号管理" },
        { href: "/admin/import", label: "批量导入账号" },
        { href: "/admin/groups", label: "组别" },
        { href: "/admin/subjects", label: "学科" },
        { href: "/admin/bank", label: "题库" },
        { href: "/admin/practice", label: "自由练习" },
        { href: "/admin/tasks", label: "全部任务" },
      ]}
    >
      {children}
    </Shell>
  );
}
