import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { readSheet } from "@/lib/excel";
import { importMcq, importVocab, importCloze } from "@/lib/importBank";

export async function POST(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const me = await currentUser();
  if (me?.role !== "admin") return NextResponse.json({ error: "无权限" }, { status: 403 });
  const { kind } = await params;
  const fd = await req.formData();
  const file = fd.get("file") as File | null;
  const subjectId = parseInt(String(fd.get("subject_id") || ""), 10);
  const tag = String(fd.get("tag") || "").trim();
  if (!file || !file.size) return NextResponse.json({ error: "请选择文件" }, { status: 400 });
  if (!Number.isFinite(subjectId)) return NextResponse.json({ error: "请选择学科" }, { status: 400 });
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    if (kind === "mcq") return NextResponse.json(importMcq(readSheet(buf), subjectId, tag));
    if (kind === "vocab") return NextResponse.json(importVocab(readSheet(buf), subjectId, tag));
    if (kind === "cloze") {
      const title = String(fd.get("title") || "").trim() || file.name.replace(/\.docx$/i, "");
      return NextResponse.json(await importCloze(buf, subjectId, title, tag));
    }
    return NextResponse.json({ error: "未知类型" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: "读取文件失败：" + e.message }, { status: 400 });
  }
}
