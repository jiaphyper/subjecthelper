import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { myOpenAttempt } from "@/lib/attemptApi";

/** 自动保存作答草稿（页面状态），刷新/切后台/断网后可以恢复。也接受 sendBeacon 的 text/plain */
export async function POST(req: Request, { params }: { params: Promise<{ aid: string }> }) {
  const aid = Number((await params).aid);
  const text = await req.text();
  const r = await myOpenAttempt(aid);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (text.length > 200_000) return NextResponse.json({ error: "草稿过大" }, { status: 413 });
  try {
    JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "格式错误" }, { status: 400 });
  }
  db.prepare("UPDATE attempts SET draft_json=? WHERE id=? AND status='in_progress'").run(text, r.a.id);
  return NextResponse.json({ ok: true });
}
