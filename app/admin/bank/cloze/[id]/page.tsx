import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import ClozeText from "@/components/ClozeText";
import { getT } from "@/lib/i18n-server";

export default async function ClozeSetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getT();
  const set = db.prepare("SELECT s.*, sub.name subject FROM cloze_sets s JOIN subjects sub ON sub.id=s.subject_id WHERE s.id=?").get(Number(id)) as any;
  if (!set) notFound();
  const items = db.prepare("SELECT * FROM cloze_items WHERE set_id=? ORDER BY sort").all(set.id) as any[];
  const bank: string[] = [];
  items.forEach((it) => {
    JSON.parse(it.segments_json).forEach((s: any) => "b" in s && bank.push(s.b));
    bank.push(...JSON.parse(it.distractors_json));
  });
  return (
    <>
      <div className="topbar">
        <h1>{set.title} <span className="muted small">（{set.subject}{set.tag ? " · " + set.tag : ""}）</span></h1>
        <a href={`/admin/bank?subject=${set.subject_id}&tab=cloze`} className="btn btn-ghost">{t("← 返回题库")}</a>
      </div>
      <div className="card">
        <h2>{t(`Word bank（${bank.length} 张卡片）`)}</h2>
        <div className="row">{bank.map((w, i) => <span key={i} className="badge gray" style={{ fontSize: 14, padding: "3px 10px" }}>{w}</span>)}</div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th style={{ width: 40 }}>#</th><th>{t("句子（高亮为空）")}</th><th>{t("干扰词")}</th></tr></thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.id}>
                <td className="muted">{i + 1}</td>
                <td><ClozeText segments={JSON.parse(it.segments_json)} /></td>
                <td className="small">{JSON.parse(it.distractors_json).join("、")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
