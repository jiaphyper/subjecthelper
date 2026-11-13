"use client";
import { useState } from "react";

interface Subj {
  id: number; name: string;
  mcqTags: { tag: string; n: number }[];
  vocabTags: { tag: string; cn: number; def: number }[];
  clozeSets: { id: number; title: string; tag: string | null; n: number }[];
}
interface Grp { id: number; name: string; teacher_id: number | null; teacher: string | null; n: number; mine: number }

export default function TaskForm({ subjects, groups, meId, action }: { subjects: Subj[]; groups: Grp[]; meId: number; action: (fd: FormData) => void }) {
  const [sid, setSid] = useState(subjects[0].id);
  const [types, setTypes] = useState<Set<string>>(new Set(["mcq"]));
  const [mcqTags, setMcqTags] = useState<Set<string>>(new Set());
  const [matchTags, setMatchTags] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"en_cn" | "en_def">("en_cn");
  const [setId, setSetId] = useState<number | "">("");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [onlyMine, setOnlyMine] = useState(false);
  const s = subjects.find((x) => x.id === sid)!;

  const toggle = <T,>(set: Set<T>, v: T, fn: (s: Set<T>) => void) => {
    const n = new Set(set);
    n.has(v) ? n.delete(v) : n.add(v);
    fn(n);
  };
  const mcqAvail = s.mcqTags.filter((t) => !mcqTags.size || mcqTags.has(t.tag)).reduce((a, t) => a + t.n, 0);
  const vocabAvail = s.vocabTags.filter((t) => !matchTags.size || matchTags.has(t.tag)).reduce((a, t) => a + Number(mode === "en_cn" ? t.cn : t.def), 0);
  const cset = s.clozeSets.find((c) => c.id === setId);
  const recipients = groups.filter((g) => picked.has(g.id)).reduce((a, g) => a + (onlyMine ? g.mine : g.n), 0);

  const TagPicker = ({ tags, sel, setSel, name, count }: { tags: { tag: string }[]; sel: Set<string>; setSel: (s: Set<string>) => void; name: string; count: (t: any) => number }) => (
    <div className="row" style={{ gap: 6 }}>
      <span className="small muted">范围：</span>
      <button type="button" className={"btn-sm " + (sel.size ? "btn-ghost" : "")} onClick={() => setSel(new Set())}>全部</button>
      {tags.map((t) => (
        <button type="button" key={t.tag} className={"btn-sm " + (sel.has(t.tag) ? "" : "btn-ghost")} onClick={() => toggle(sel, t.tag, setSel)}>
          {t.tag || "(无标签)"} · {count(t)}
        </button>
      ))}
      {[...sel].map((t) => <input key={t} type="hidden" name={name} value={t} />)}
    </div>
  );

  return (
    <form action={action}>
      <div className="card">
        <div className="grid3">
          <div style={{ gridColumn: "span 2" }}><label>任务名称 *</label><input type="text" name="title" required placeholder="如：Unit 1 词汇练习" /></div>
          <div>
            <label>学科 *</label>
            <select name="subject_id" value={sid} onChange={(e) => { setSid(Number(e.target.value)); setMcqTags(new Set()); setMatchTags(new Set()); setSetId(""); }}>
              {subjects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </div>
          <div><label>每人可尝试次数</label><input type="number" name="max_attempts" defaultValue={3} min={1} max={10} /></div>
          <div><label>截止时间（可选）</label><input type="datetime-local" name="due_at" /></div>
        </div>
      </div>

      <div className="card">
        <h2>题型（可多选）</h2>
        {/* 选择题 */}
        <div className="card" style={{ background: types.has("mcq") ? "#fff" : "#fafaf7" }}>
          <label className="row" style={{ color: "var(--ink)", fontSize: 15, fontWeight: 600 }}>
            <input type="checkbox" name="type" value="mcq" checked={types.has("mcq")} onChange={() => toggle(types, "mcq", setTypes)} /> 选择题
            <span className="muted small" style={{ fontWeight: 400 }}>题库共 {s.mcqTags.reduce((a, t) => a + t.n, 0)} 道</span>
          </label>
          {types.has("mcq") && (
            <div className="stack" style={{ marginTop: 8 }}>
              <TagPicker tags={s.mcqTags} sel={mcqTags} setSel={setMcqTags} name="mcq_tags" count={(t) => t.n} />
              <div className="row"><span className="small muted">题目数量：</span><input type="number" name="mcq_count" defaultValue={Math.min(10, mcqAvail) || 1} min={1} style={{ width: 90 }} /><span className="small muted">可用 {mcqAvail} 道，随机抽取</span></div>
            </div>
          )}
        </div>
        {/* 连线题 */}
        <div className="card" style={{ background: types.has("match") ? "#fff" : "#fafaf7" }}>
          <label className="row" style={{ color: "var(--ink)", fontSize: 15, fontWeight: 600 }}>
            <input type="checkbox" name="type" value="match" checked={types.has("match")} onChange={() => toggle(types, "match", setTypes)} /> 连线题
          </label>
          {types.has("match") && (
            <div className="stack" style={{ marginTop: 8 }}>
              <div className="row">
                <span className="small muted">连线方式：</span>
                <label className="row" style={{ margin: 0, color: "var(--ink)" }}><input type="radio" name="match_mode" value="en_cn" checked={mode === "en_cn"} onChange={() => setMode("en_cn")} /> 英文 — 中文</label>
                <label className="row" style={{ margin: 0, color: "var(--ink)" }}><input type="radio" name="match_mode" value="en_def" checked={mode === "en_def"} onChange={() => setMode("en_def")} /> 英文 — 英文释义</label>
              </div>
              <TagPicker tags={s.vocabTags} sel={matchTags} setSel={setMatchTags} name="match_tags" count={(t) => Number(mode === "en_cn" ? t.cn : t.def)} />
              <div className="row"><span className="small muted">词对数量：</span><input type="number" name="match_count" defaultValue={Math.min(8, vocabAvail) || 2} min={2} style={{ width: 90 }} /><span className="small muted">可用 {vocabAvail} 个；每 8 对一组显示</span></div>
            </div>
          )}
        </div>
        {/* 填空 */}
        <div className="card" style={{ background: types.has("cloze") ? "#fff" : "#fafaf7", marginBottom: 0 }}>
          <label className="row" style={{ color: "var(--ink)", fontSize: 15, fontWeight: 600 }}>
            <input type="checkbox" name="type" value="cloze" checked={types.has("cloze")} onChange={() => toggle(types, "cloze", setTypes)} /> 挖空填词（Word bank 拖拽）
          </label>
          {types.has("cloze") && (
            <div className="row" style={{ marginTop: 8 }}>
              <select name="cloze_set" value={setId} onChange={(e) => setSetId(e.target.value ? Number(e.target.value) : "")} style={{ maxWidth: 360 }} required>
                <option value="">选择套题…</option>
                {s.clozeSets.map((c) => <option key={c.id} value={c.id}>{c.title}{c.tag ? ` [${c.tag}]` : ""}（{c.n} 句）</option>)}
              </select>
              <span className="small muted">抽取句子数：</span>
              <input type="number" name="cloze_count" key={setId} defaultValue={cset?.n ?? 0} min={0} max={cset?.n} style={{ width: 90 }} />
              <span className="small muted">0 或最大值 = 全部</span>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2>发布给哪些组别</h2>
        <label className="row" style={{ color: "var(--ink)", marginBottom: 8 }}>
          <input type="checkbox" name="only_mine" value="1" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> 只发给组内绑定给我的学生
        </label>
        <div className="checklist">
          {groups.map((g) => (
            <label key={g.id}>
              <input type="checkbox" name="group" value={g.id} checked={picked.has(g.id)} onChange={() => toggle(picked, g.id, setPicked)} />
              <b>{g.name}</b>
              <span className="muted small">{g.n} 人{g.mine !== g.n ? `（我的学生 ${g.mine}）` : ""}</span>
            </label>
          ))}
          {!groups.length && <div className="muted small">你还没有组别，请先到「组别」页面创建。</div>}
        </div>
        <p className="small muted">预计接收：{recipients} 人次（同一学生在多个组中只算一次）</p>
      </div>
      <button style={{ padding: "10px 24px" }}>发布任务</button>
    </form>
  );
}
