"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PublicContent } from "@/lib/tasks";
import McqQuestion from "./Mcq";
import { BoardView } from "./Matching";
import Cloze, { Place } from "./Cloze";
import { useT } from "../I18nProvider";

type Recorded = Record<string, { score: number; total: number }>;
type Marks = Record<string, boolean | boolean[]>;
type LastScore = Record<string, { score: number; total: number; first: boolean }>;
export interface Draft {
  idx?: number;
  mcq?: Record<string, number>;
  match?: Record<string, number>;
  place?: Place;
  marks?: Record<string, Marks>;
  lastScore?: LastScore;
}

export default function Runner({ taskId, attemptId, title, attemptNo, maxAttempts, practice, content, initialChecked, initialDraft }: {
  taskId: number; attemptId: number; title: string; attemptNo: number; maxAttempts: number; practice?: boolean;
  content: PublicContent; initialChecked: Recorded; initialDraft: Draft;
}) {
  const t = useT();
  const units = useMemo(() => [
    ...(content.mcq ?? []).map((q) => `mcq:${q.id}`),
    ...(content.match?.boards ?? []).map((_, i) => `match:${i}`),
    ...(content.cloze ? ["cloze"] : []),
  ], [content]);
  const firstOpen = units.findIndex((u) => !(u in initialChecked));
  const [idx, setIdx] = useState(initialDraft.idx !== undefined && initialDraft.idx < units.length ? initialDraft.idx : firstOpen < 0 ? 0 : firstOpen);
  const [recorded, setRecorded] = useState<Recorded>(initialChecked);
  const [marks, setMarks] = useState<Record<string, Marks>>(initialDraft.marks ?? {});      // 最近一次校验的对错
  const [lastScore, setLastScore] = useState<LastScore>(initialDraft.lastScore ?? {});
  const [mcq, setMcq] = useState<Record<string, number>>(initialDraft.mcq ?? {});
  const [match, setMatch] = useState<Record<string, number>>(initialDraft.match ?? {});
  const [place, setPlace] = useState<Place>(initialDraft.place ?? {});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState<"" | "saving" | "saved" | "error">("");

  /* ---------- 自动保存草稿 ---------- */
  const draftUrl = `/api/student/attempts/${attemptId}/draft`;
  const draft = useMemo<Draft>(() => ({ idx, mcq, match, place, marks, lastScore }), [idx, mcq, match, place, marks, lastScore]);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const dirty = useRef(false);
  const first = useRef(true);
  const flush = useCallback(async () => {
    if (!dirty.current) return;
    dirty.current = false;
    setSaved("saving");
    try {
      const r = await fetch(draftUrl, { method: "POST", body: JSON.stringify(draftRef.current) });
      setSaved(r.ok ? "saved" : "error");
    } catch {
      dirty.current = true;
      setSaved("error");
    }
  }, [draftUrl]);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    dirty.current = true;
    const h = setTimeout(flush, 800);
    return () => clearTimeout(h);
  }, [draft, flush]);
  useEffect(() => {
    // 关闭页面 / 切到后台时立即保存
    const beacon = () => {
      if (dirty.current && navigator.sendBeacon) {
        dirty.current = false;
        navigator.sendBeacon(draftUrl, new Blob([JSON.stringify(draftRef.current)], { type: "text/plain" }));
      }
    };
    const vis = () => document.visibilityState === "hidden" && beacon();
    window.addEventListener("pagehide", beacon);
    document.addEventListener("visibilitychange", vis);
    return () => { window.removeEventListener("pagehide", beacon); document.removeEventListener("visibilitychange", vis); };
  }, [draftUrl]);

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
    if (unit.startsWith("mcq:")) return a === undefined ? t("请先选择一个答案") : null;
    if (unit.startsWith("match:")) {
      const b = content.match!.boards[Number(unit.slice(6))];
      const n = Object.keys(a).length;
      return n < b.left.length ? t(`还有 ${b.left.length - n} 个没连，确定校验吗？`) : null;
    }
    const blanks = Object.values(a as Record<string, any[]>).flat();
    const empty = blanks.filter((x) => !x).length;
    return empty ? t(`还有 ${empty} 个空没填，确定校验吗？`) : null;
  }

  async function check() {
    const warn = answeredEnough();
    if (warn) {
      if (unit.startsWith("mcq:")) { setErr(warn); return; }
      if (!confirm(warn)) return;
    }
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/student/attempts/${attemptId}/check`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unit, answer: currentAnswer() }) });
      const d = await r.json();
      if (!r.ok) { setErr(t(d.error || "校验失败")); return; }
      setMarks((m) => ({ ...m, [unit]: d.marks }));
      setLastScore((s) => ({ ...s, [unit]: { score: d.score, total: d.total, first: d.first } }));
      setRecorded((rec) => ({ ...rec, [unit]: d.recorded }));
    } catch {
      setErr(t("网络错误，请重试"));
    } finally {
      setBusy(false);
    }
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
      ? t(`还有 ${unchecked} 道题没有校验，这些题将记 0 分。确定结束第 ${attemptNo} 次作答吗？`)
      : t(`确定结束第 ${attemptNo} 次作答？本次得分 ${recordedScore}/${totalPossible}。`);
    if (!confirm(msg)) return;
    setBusy(true);
    dirty.current = false;
    try {
      const r = await fetch(`/api/student/attempts/${attemptId}/finish`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) { setErr(t(d.error || "提交失败")); setBusy(false); return; }
      window.location.href = `/student/tasks/${taskId}?n=${d.attemptNo}&done=1`;
    } catch {
      setErr(t("网络错误，请重试"));
      setBusy(false);
    }
  }

  const kindLabel = (u: string) => (u.startsWith("mcq:") ? t("选择题") : u.startsWith("match:") ? t("连线题") : t("挖空填词"));
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
          <a href={`/student/tasks/${taskId}`} className="small">{t("← 返回（进度会自动保存）")}</a>
          <h1 style={{ margin: "4px 0 0" }}>{title}</h1>
          <div className="small muted">
            {practice ? t(`练习 · 第 ${attemptNo} 次`) : t(`第 ${attemptNo} / ${maxAttempts} 次`)} · {t(`已得 ${recordedScore} / ${totalPossible} 分`)}
            {saved && <span className="save-state"> · {saved === "saving" ? t("保存中…") : saved === "saved" ? t("已自动保存") : t("保存失败，将重试")}</span>}
          </div>
        </div>
        <button onClick={finish} disabled={busy} className="btn-ghost btn-sm">{t("结束本次作答")}</button>
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
        {rec && <span className="badge">{t(`本题已计分：${rec.score}/${rec.total}`)}</span>}
      </div>
      {err && <div className="flash bad">{err}</div>}

      {unit.startsWith("mcq:") && (
        <McqQuestion q={content.mcq!.find((q) => `mcq:${q.id}` === unit)!} value={mcq[unit.slice(4)]} locked={locked}
          mark={marks[unit]?.[unit.slice(4)] as boolean | undefined} onChange={(v) => setMcq({ ...mcq, [unit.slice(4)]: v })} />
      )}
      {unit.startsWith("match:") && (
        <BoardView key={unit} board={content.match!.boards[Number(unit.slice(6))]} mode={content.match!.boards[Number(unit.slice(6))].mode ?? content.match!.mode ?? "en_cn"}
          value={match} onChange={setMatch} locked={locked} marks={marks[unit] as Record<string, boolean> | undefined} />
      )}
      {unit === "cloze" && (
        <Cloze data={content.cloze!} place={place} setPlace={setPlace} locked={locked} marks={marks[unit] as Record<string, boolean[]> | undefined} />
      )}

      <div className="check-bar">
        {!locked ? (
          <>
            <span className="muted small">{rec ? t("这道题已计分，现在是练习，校验结果不再计分。") : t("做完点「校验」，第一次校验的结果计入成绩。")}</span>
            <button onClick={check} disabled={busy} className="right check-btn">{busy ? t("校验中…") : t("校验")}</button>
          </>
        ) : (
          <>
            <span className={"check-result " + (ls && ls.score === ls.total ? "ok" : "bad")}>
              {ls && ls.score === ls.total ? t("全部正确！") : t(`对 ${ls?.score ?? 0} / ${ls?.total ?? 0}`)}
              <span className="small" style={{ fontWeight: 400, marginLeft: 8 }}>{ls?.first ? t("（已计入成绩）") : t("（练习，不计分）")}</span>
            </span>
            <span className="right row">
              {ls && ls.score < ls.total && <button className="btn-ghost" onClick={retry}>{t("再来一次")}</button>}
              {idx < units.length - 1
                ? <button onClick={() => go(idx + 1)}>{t("下一题 →")}</button>
                : <button onClick={finish} disabled={busy}>{t("完成，提交本次作答")}</button>}
            </span>
          </>
        )}
      </div>
      {!locked && idx < units.length - 1 && (
        <div style={{ textAlign: "right", marginTop: 8 }}><a href="#" className="small" onClick={(e) => { e.preventDefault(); go(idx + 1); }}>{t("跳过，先做下一题 →")}</a></div>
      )}
    </div>
  );
}
