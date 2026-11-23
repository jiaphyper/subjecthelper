import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { myOpenAttempt } from "@/lib/attemptApi";
import { gradeUnit, mergeAnswers } from "@/lib/tasks";
import { recompute } from "@/lib/studentTask";

/** 校验一个题目单元：首次校验计分并记录，之后的校验只是练习 */
export async function POST(req: Request, { params }: { params: Promise<{ aid: string }> }) {
  // 先把所有 await 做完，后面的读-改-写全部同步执行，避免并发请求互相覆盖
  const aid = Number((await params).aid);
  const body = await req.json().catch(() => null);
  const r = await myOpenAttempt(aid);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (!body || typeof body.unit !== "string") return NextResponse.json({ error: "题目无效" }, { status: 400 });
  const unit: string = body.unit;

  const out = db.transaction(() => {
    const a = db.prepare("SELECT a.*, t.content_json FROM attempts a JOIN tasks t ON t.id=a.task_id WHERE a.id=?").get(r.a.id) as any;
    const g = gradeUnit(JSON.parse(a.content_json), JSON.parse(a.layout_json), unit, body.answer);
    if (!g) return null;
    const checked: Record<string, { score: number; total: number }> = JSON.parse(a.checked_json || "{}");
    const first = !(unit in checked);
    if (first) {
      checked[unit] = { score: g.check.score, total: g.check.total };
      const answers = mergeAnswers(JSON.parse(a.answers_json), g.patch);
      db.prepare("UPDATE attempts SET checked_json=?, answers_json=? WHERE id=?").run(JSON.stringify(checked), JSON.stringify(answers), a.id);
      recompute(a.id);
    }
    return { ...g.check, first, recorded: checked[unit] };
  })();
  if (!out) return NextResponse.json({ error: "题目无效" }, { status: 400 });
  return NextResponse.json(out);
}
