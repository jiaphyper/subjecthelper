import { NextResponse } from "next/server";
import { myOpenAttempt } from "@/lib/attemptApi";
import { finishAttempt } from "@/lib/studentTask";

export async function POST(_req: Request, { params }: { params: Promise<{ aid: string }> }) {
  const r = await myOpenAttempt(Number((await params).aid));
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const result = finishAttempt(r.a.id);
  return NextResponse.json({ taskId: r.a.task_id, attemptNo: r.a.attempt_no, score: result.score, total: result.total });
}
