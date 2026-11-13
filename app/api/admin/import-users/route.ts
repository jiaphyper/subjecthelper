import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { readSheet } from "@/lib/excel";
import { importUsers } from "@/lib/importUsers";

export async function POST(req: Request) {
  const me = await currentUser();
  if (me?.role !== "admin") return NextResponse.json({ error: "无权限" }, { status: 403 });
  const fd = await req.formData();
  const file = fd.get("file") as File | null;
  if (!file || !file.size) return NextResponse.json({ error: "请选择文件" }, { status: 400 });
  const orgId = parseInt(String(fd.get("org_id") || ""), 10);
  try {
    const rows = readSheet(Buffer.from(await file.arrayBuffer()));
    const res = importUsers(rows, Number.isFinite(orgId) ? orgId : null);
    return NextResponse.json(res);
  } catch (e: any) {
    return NextResponse.json({ error: "读取文件失败：" + e.message }, { status: 400 });
  }
}
