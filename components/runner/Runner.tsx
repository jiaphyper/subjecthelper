"use client";
import { useMemo, useState } from "react";
import type { PublicContent } from "@/lib/tasks";
import McqQuestion from "./Mcq";
import { BoardView } from "./Matching";
import Cloze, { Place } from "./Cloze";

type Recorded = Record<string, { score: number; total: number }>;
type Marks = Record<string, boolean | boolean[]>;

export default function Runner({ taskId, attemptId, title, attemptNo, maxAttempts, content, initialChecked }: {
  taskId: number; attemptId: number; title: string; attemptNo: number; maxAttempts: number; content: PublicContent; initialChecked: Recorded;
}) {
  const units = useMemo(() => [
    ...(content.mcq ?? []).map((q) => `mcq:${q.id}`),
    ...(content.match?.boards ?? []).map((_, i) => `match:${i}`),
    ...(content.cloze ? ["cloze"] : []),
  ], [content]);
  const firstOpen = units.findIndex((u) => !(u in initialChecked));
  const [idx, setIdx] = useState(firstOpen < 0 ? 0 : firstOpen);
  const [recorded, setRecorded] = useState<Recorded>(initialChecked);
  const [marks, setMarks] = useState<Record<string, Marks>>({});      // 最近一次校验的对错
  const [lastScore, setLastScore] = useState<Record<string, { score: number; total: number; first: boolean }>>({});
  const [mcq, setMcq] = useState<Record<string, number>>({});
  const [match, setMatch] = useState<Record<string, number>>({});
  const [place, setPlace] = useState<Place>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const unit = units[idx];
  const locked = !!marks[unit];
  const totalPossible = useMemo(() => {
    const m = content.mcq?.length ?? 0;
    const p = content.match?.boards.reduce((a, b) => a + b.left.length, 0) ?? 0;
    const c = content.cloze?.items.reduce((a, it) => a + it.parts.filter((x) => typeof x !== "string").length, 0) ?? 0;
    return m + p + c;
  }, [content]);
  const recordedScore = Object.values(recorded).reduce((a, r) => a + r.score, 0);
  const unchecked = units.filter((u) => !(u in recorded)).length;

  /* 当前单元的答案 */
  function currentAnswer(): any {
    if (unit.startsWith("mcq:")) return mcq[unit.slice(4)];
    if (unit.startsWith("match:")) {
      const b = content.match!.boards[Number(unit.slice(6))];
      return Object.fromEntries(b.left.filter((l) => match[l.id] !== undefined).map((l) => [l.id, match[l.id]]));
    }
    if (unit === "cloze") {
      const out: Record<string, (string | null)[]> = {};
      for (const it of content.cloze!.items) {
        const n = it.parts.filter((p) => typeof p !== "string").length;
        out[it.id] = Array.from({ length: n }, (_, k) => { const c = place[`${it.id}:${k}`]; return c === undefined ? null : content.cloze!.bank[c]; });
      }
      return out;
    }
  }
  function answeredEnough(): string | null {
    const a = currentAnswer();
    if (unit.startsWith("mcq:")) return a === undefined ? "请先选择一个答案" : null;
    if (unit.startsWith("match:")) {
      const b = content.match!.boards[Number(unit.slice(6))];
      const n = Object.keys(a).length;
      return n < b.left.length ? `还有 ${b.left.length - n} 个没连，确定校验吗？` : null;
    }
    const blanks = Object.values(a as Record<string, any[]>).flat();
    const empty = blanks.filter((x) => !x).length;
    return empty ? `还有 ${empty} 个空没填，确定校验吗？` : null;
  }

  async function check() {
    const warn = answeredEnough();
    if (warn) {
      if (unit.startsWith("mcq:")) { setErr(warn); return; }
      if (!confirm(warn)) return;
    }
    setBusy(true); setErr("");
    const r = await fetch(`/api/student/attempts/${attemptId}/check`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unit, answer: currentAnswer() }) });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) { setErr(d.error || "校验失败"); return; }
    setMarks({ ...marks, [unit]: d.marks });
    setLastScore({ ...lastScore, [unit]: { score: d.score, total: d.total, first: d.first } });
    setRecorded({ ...recorded, [unit]: d.recorded });
  }

  /** 再来一次：清掉做错的部分 */
  function retry() {
    const m = marks[unit] ?? {};
    if (unit.startsWith("mcq:")) { const v = { ...mcq }; delete v[unit.slice(4)]; setMcq(v); }
    else if (unit.startsWith("match:")) {
      const v = { ...match };
      for (const [k, ok] of Object.entries(m)) if (!ok) delete v[k as any];
      setMatch(v);
    } else {
      const p = { ...place };
      for (const [itemId, arr] of Object.entries(m)) (arr as boolean[]).forEach((ok, k) => { if (!ok) delete p[`${itemId}:${k}`]; });
      setPlace(p);
    }
    const nm = { ...marks }; delete nm[unit]; setMarks(nm);
  }

  function go(i: number) { setIdx(i); setErr(""); window.scrollTo(0, 0); }

  async function finish() {
    const msg = unchecked
      ? `还有 ${unchecked} 道题没有校验，这些题将记 0 分。确定结束第 ${attemptNo} 次作答吗？`
      : `确定结束第 ${attemptNo} 次作答？本次得分 ${recordedScore}/${totalPossible}。`;
    if (!confirm(msg)) return;
    setBusy(true);
    const r = await fetch(`/api/student/attempts/${attemptId}/finish`, { method: "POST" });
    const d = await r.json();
    if (!r.ok) { setErr(d.error || "提交失败"); setBusy(false); return; }
    window.location.href = `/student/tasks/${taskId}?n=${d.attemptNo}&done=1`;
  }

  const kindLabel = (u: string) => (u.startsWith("mcq:") ? "选择题" : u.startsWith("match:") ? "连线题" : "挖空填词");
  const unitNo = (u: string) => {
    const same = units.filter((x) => kindLabel(x) === kindLabel(u));
    return same.length > 1 ? ` ${same.indexOf(u) + 1}/${same.length}` : "";
  };
  const ls = lastScore[unit];
  const rec = recorded[unit];

  return (
    <div className="runner">
      <div className="runner-head">
        <div>
          <a href={`/student/tasks/${taskId}`} className="small">← 返回（进度会保留）</a>
          <h1 style={{ margin: "4px 0 0" }}>{title}</h1>
          <div className="small muted">第 {attemptNo} / {maxAttempts} 次 · 已得 <b>{recordedScore}</b> / {totalPossible} 分</div>
        </div>
        <button onClick={finish} disabled={busy} className="btn-ghost">结束本次作答</button>
      </div>

      <div className="unit-nav">
        {units.map((u, i) => {
          const r = recorded[u];
          const cls = !r ? "" : r.score === r.total ? "full" : r.score === 0 ? "zero" : "part";
          return (
            <button key={u} type="button" className={`unit-dot ${cls} ${i === idx ? "cur" : ""}`} onClick={() => go(i)} title={kindLabel(u) + unitNo(u)}>
              {i + 1}
            </button>
          );
        })}
      </div>

      <div className="row" style={{ margin: "6px 0 10px" }}>
        <h2 style={{ margin: 0 }}>{kindLabel(unit)}{unitNo(unit)}</h2>
        {rec && <span className="badge">本题已计分：{rec.score}/{rec.total}</span>}
      </div>
      {err && <div className="flash bad">{err}</div>}

      {unit.startsWith("mcq:") && (
        <McqQuestion q={content.mcq!.find((q) => `mcq:${q.id}` === unit)!} value={mcq[unit.slice(4)]} locked={locked}
          mark={marks[unit]?.[unit.slice(4)] as boolean | undefined} onChange={(v) => setMcq({ ...mcq, [unit.slice(4)]: v })} />
      )}
      {unit.startsWith("match:") && (
        <BoardView key={unit} board={content.match!.boards[Number(unit.slice(6))]} mode={content.match!.mode}
          value={match} onChange={setMatch} locked={locked} marks={marks[unit] as Record<string, boolean> | undefined} />
      )}
      {unit === "cloze" && (
        <Cloze data={content.cloze!} place={place} setPlace={setPlace} locked={locked} marks={marks[unit] as Record<string, boolean[]> | undefined} />
      )}

      <div className="check-bar">
        {!locked ? (
          <>
            <span className="muted small">{rec ? "这道题已计分，现在是练习，校验结果不再计分。" : "做完点「校验」，第一次校验的结果计入成绩。"}</span>
            <button onClick={check} disabled={busy} className="right" style={{ padding: "10px 26px", fontSize: 16 }}>{busy ? "校验中…" : "校验"}</button>
          </>
        ) : (
          <>
            <span className={"check-result " + (ls && ls.score === ls.total ? "ok" : "bad")}>
              {ls && ls.score === ls.total ? "全部正确！" : `对 ${ls?.score} / ${ls?.total}`}
              <span className="small" style={{ fontWeight: 400, marginLeft: 8 }}>{ls?.first ? "（已计入成绩）" : "（练习，不计分）"}</span>
            </span>
            <span className="right row">
              {ls && ls.score < ls.total && <button className="btn-ghost" onClick={retry}>再来一次</button>}
              {idx < units.length - 1
                ? <button onClick={() => go(idx + 1)}>下一题 →</button>
                : <button onClick={finish} disabled={busy}>完成，提交本次作答</button>}
            </span>
          </>
        )}
      </div>
      {!locked && idx < units.length - 1 && (
        <div style={{ textAlign: "right", marginTop: 8 }}><a href="#" className="small" onClick={(e) => { e.preventDefault(); go(idx + 1); }}>跳过，先做下一题 →</a></div>
      )}
    </div>
  );
}
