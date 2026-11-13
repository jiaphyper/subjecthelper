import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { myOpenAttempt } from "@/lib/attemptApi";
import { gradeUnit, mergeAnswers } from "@/lib/tasks";
import { recompute } from "@/lib/studentTask";

/** 校验一个题目单元：首次校验计分并记录，之后的校验只是练习 */
export async function POST(req: Request, { params }: { params: Promise<{ aid: string }> }) {
  const r = await myOpenAttempt(Number((await params).aid));
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const { a } = r;
  const { unit, answer } = await req.json();
  const g = gradeUnit(JSON.parse(a.content_json), JSON.parse(a.layout_json), String(unit), answer);
  if (!g) return NextResponse.json({ error: "题目无效" }, { status: 400 });

  const checked: Record<string, { score: number; total: number }> = JSON.parse(a.checked_json || "{}");
  const first = !(unit in checked);
  if (first) {
    checked[unit] = { score: g.check.score, total: g.check.total };
    const answers = mergeAnswers(JSON.parse(a.answers_json), g.patch);
    db.prepare("UPDATE attempts SET checked_json=?, answers_json=? WHERE id=?").run(JSON.stringify(checked), JSON.stringify(answers), a.id);
    recompute(a.id);
  }
  return NextResponse.json({ ...g.check, first, recorded: checked[unit] });
}
