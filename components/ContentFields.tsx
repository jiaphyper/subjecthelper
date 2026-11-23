"use client";
import { useState } from "react";
import type { SubjectOption } from "@/lib/subjectOptions";
import { useT } from "./I18nProvider";

type Mode = "en_cn" | "en_def";

function toggleIn<T>(set: Set<T>, v: T): Set<T> {
  const n = new Set(set);
  n.has(v) ? n.delete(v) : n.add(v);
  return n;
}

function TagPicker({ tags, sel, setSel, name, count }: {
  tags: { tag: string }[]; sel: Set<string>; setSel: (s: Set<string>) => void; name: string; count: (t: any) => number;
}) {
  const t = useT();
  return (
    <div className="row" style={{ gap: 6 }}>
      <span className="small muted">{t("范围：")}</span>
      <button type="button" className={"btn-sm " + (sel.size ? "btn-ghost" : "")} onClick={() => setSel(new Set())}>{t("全部")}</button>
      {tags.map((x) => (
        <button type="button" key={x.tag} className={"btn-sm " + (sel.has(x.tag) ? "" : "btn-ghost")} onClick={() => setSel(toggleIn(sel, x.tag))}>
          {x.tag || t("(无标签)")} · {count(x)}
        </button>
      ))}
      {[...sel].map((v) => <input key={v} type="hidden" name={name} value={v} />)}
    </div>
  );
}

/** 学科 + 题型配置（教师布置任务、学生自由组卷共用） */
export default function ContentFields({ subjects, limits }: { subjects: SubjectOption[]; limits?: { mcq: number; match: number } }) {
  const t = useT();
  const [sid, setSid] = useState(subjects[0].id);
  const [types, setTypes] = useState<Set<string>>(new Set(["mcq"]));
  const [mcqTags, setMcqTags] = useState<Set<string>>(new Set());
  const [matchTags, setMatchTags] = useState<Set<string>>(new Set());
  const [modes, setModes] = useState<Set<Mode>>(new Set(["en_cn"]));
  const [setId, setSetId] = useState<number | "">("");
  const s = subjects.find((x) => x.id === sid)!;

  const mcqAvail = s.mcqTags.filter((x) => !mcqTags.size || mcqTags.has(x.tag)).reduce((a, x) => a + x.n, 0);
  const vt = s.vocabTags.filter((x) => !matchTags.size || matchTags.has(x.tag));
  const cnAvail = vt.reduce((a, x) => a + Number(x.cn), 0);
  const defAvail = vt.reduce((a, x) => a + Number(x.def), 0);
  const field = modes.has("en_cn") && modes.has("en_def") ? "any" : modes.has("en_def") ? "def" : "cn";
  const vocabAvail = modes.size ? vt.reduce((a, x) => a + Number(x[field]), 0) : 0;
  const cset = s.clozeSets.find((c) => c.id === setId);
  const cap = (n: number, max?: number) => (max ? Math.min(n, max) : n);

  const typeBox = (key: string, label: string, extra?: React.ReactNode, last = false) => (
    <label className="row" style={{ color: "var(--ink)", fontSize: 15, fontWeight: 600, margin: 0 }}>
      <input type="checkbox" name="type" value={key} checked={types.has(key)} onChange={() => setTypes(toggleIn(types, key))} /> {label}
      {extra}
    </label>
  );

  return (
    <>
      <div className="field" style={{ maxWidth: 360 }}>
        <label>{t("学科 *")}</label>
        <select name="subject_id" value={sid} onChange={(e) => { setSid(Number(e.target.value)); setMcqTags(new Set()); setMatchTags(new Set()); setSetId(""); }}>
          {subjects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </div>
      <h2>{t("题型（可多选）")}</h2>

      {/* 选择题 */}
      <div className={"type-card" + (types.has("mcq") ? " on" : "")}>
        {typeBox("mcq", t("选择题"), <span className="muted small" style={{ fontWeight: 400 }}>{t(`题库共 ${s.mcqTags.reduce((a, x) => a + x.n, 0)} 道`)}</span>)}
        {types.has("mcq") && (
          <div className="stack" style={{ marginTop: 8 }}>
            <TagPicker tags={s.mcqTags} sel={mcqTags} setSel={setMcqTags} name="mcq_tags" count={(x) => x.n} />
            <div className="row">
              <span className="small muted">{t("题目数量：")}</span>
              <input type="number" name="mcq_count" defaultValue={cap(Math.min(10, mcqAvail), limits?.mcq) || 1} min={1} max={limits?.mcq} style={{ width: 90 }} />
              <span className="small muted">{t(`可用 ${mcqAvail} 道，随机抽取`)}</span>
            </div>
          </div>
        )}
      </div>

      {/* 连线题 */}
      <div className={"type-card" + (types.has("match") ? " on" : "")}>
        {typeBox("match", t("连线题"))}
        {types.has("match") && (
          <div className="stack" style={{ marginTop: 8 }}>
            <div className="row">
              <span className="small muted">{t("连线方式（可多选）：")}</span>
              <label className="row" style={{ margin: 0, color: "var(--ink)" }}>
                <input type="checkbox" name="match_mode" value="en_cn" checked={modes.has("en_cn")} disabled={!cnAvail && !modes.has("en_cn")} onChange={() => setModes(toggleIn(modes, "en_cn"))} />
                {t("英文 — 中文")} <span className="muted small">({cnAvail})</span>
              </label>
              <label className="row" style={{ margin: 0, color: defAvail ? "var(--ink)" : "var(--muted)" }} title={defAvail ? "" : t("题库中这些词没有英文释义")}>
                <input type="checkbox" name="match_mode" value="en_def" checked={modes.has("en_def")} disabled={!defAvail && !modes.has("en_def")} onChange={() => setModes(toggleIn(modes, "en_def"))} />
                {t("英文 — 英文释义")} <span className="muted small">({defAvail})</span>
              </label>
            </div>
            {!defAvail && <div className="small muted">{t("所选范围的词汇没有英文释义，「英文—英文释义」不可选。上传词汇时填写「英文释义」列即可使用。")}</div>}
            {modes.has("en_def") && modes.has("en_cn") && <div className="small muted">{t("两种都勾选时，题目在两种方式间平均分配；只有中文（或只有释义）的词只用于对应方式。")}</div>}
            {!modes.size && <div className="small" style={{ color: "var(--bad)" }}>{t("请至少勾选一种连线方式")}</div>}
            <label className="row" style={{ margin: 0, color: "var(--ink)" }}>
              <input type="checkbox" name="match_swap" value="1" defaultChecked /> {t("左右随机交换（每组随机决定英文在左边还是右边）")}
            </label>
            <TagPicker tags={s.vocabTags} sel={matchTags} setSel={setMatchTags} name="match_tags" count={(x) => Number(x[field])} />
            <div className="row">
              <span className="small muted">{t("词对数量：")}</span>
              <input type="number" name="match_count" defaultValue={cap(Math.min(8, vocabAvail), limits?.match) || 2} min={2} max={limits?.match} style={{ width: 90 }} />
              <span className="small muted">{t(`可用 ${vocabAvail} 个；每 8 对一组显示`)}</span>
            </div>
          </div>
        )}
      </div>

      {/* 填空 */}
      <div className={"type-card" + (types.has("cloze") ? " on" : "")} style={{ marginBottom: 0 }}>
        {typeBox("cloze", t("挖空填词（Word bank 拖拽）"))}
        {types.has("cloze") && (
          <div className="row" style={{ marginTop: 8 }}>
            <select name="cloze_set" value={setId} onChange={(e) => setSetId(e.target.value ? Number(e.target.value) : "")} style={{ maxWidth: 360 }} required>
              <option value="">{t("选择套题…")}</option>
              {s.clozeSets.map((c) => <option key={c.id} value={c.id}>{c.title}{c.tag ? ` [${c.tag}]` : ""}{t(`（${c.n} 句）`)}</option>)}
            </select>
            <span className="small muted">{t("抽取句子数：")}</span>
            <input type="number" name="cloze_count" key={setId} defaultValue={cset?.n ?? 0} min={0} max={cset?.n} style={{ width: 90 }} />
            <span className="small muted">{t("0 或最大值 = 全部")}</span>
          </div>
        )}
      </div>
    </>
  );
}
