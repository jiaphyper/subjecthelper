import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { taskResults } from "@/lib/results";
import { makeWorkbook } from "@/lib/excel";
import { getT } from "@/lib/i18n-server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  const id = Number((await params).id);
  const t = db.prepare("SELECT * FROM tasks WHERE id=?").get(id) as any;
  if (!me || !t || me.role === "student" || (me.role === "teacher" && t.teacher_id !== me.id)) return new Response("Forbidden", { status: 403 });
  const tr = await getT();
  const rows = taskResults(id);
  const head = [tr("用户名"), tr("姓名"), tr("组别"), ...Array.from({ length: t.max_attempts }, (_, i) => tr(`第 ${i + 1} 次`)), tr("最高分(%)"), tr("最近提交")];
  const data = rows.map((r) => [
    r.username, r.name, r.grps ?? "",
    ...Array.from({ length: t.max_attempts }, (_, i) => (r.attempts[i] ? `${r.attempts[i].score}/${r.attempts[i].total}` : "")),
    r.best ?? "", r.last ?? "",
  ]);
  const buf = makeWorkbook(tr("成绩"), [head, ...data], [12, 10, 16, ...Array(t.max_attempts).fill(10), 10, 18]);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(t.title + "_" + tr("成绩") + ".xlsx")}`,
    },
  });
}
