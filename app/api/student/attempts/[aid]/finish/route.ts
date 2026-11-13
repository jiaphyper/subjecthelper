import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { myOpenAttempt } from "@/lib/attemptApi";
import { recompute } from "@/lib/studentTask";

export async function POST(_req: Request, { params }: { params: Promise<{ aid: string }> }) {
  const r = await myOpenAttempt(Number((await params).aid));
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const result = recompute(r.a.id);
  db.prepare("UPDATE attempts SET status='submitted', submitted_at=datetime('now') WHERE id=?").run(r.a.id);
  return NextResponse.json({ taskId: r.a.task_id, attemptNo: r.a.attempt_no, score: result.score, total: result.total });
}
