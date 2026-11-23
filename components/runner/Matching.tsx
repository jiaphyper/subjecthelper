"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useT } from "../I18nProvider";

type Item = { id: number; text: string };
type Board = { left: Item[]; right: Item[]; swap?: boolean };
const COLORS = ["#2f5d50", "#c2410c", "#1d4ed8", "#9333ea", "#be123c", "#0e7490", "#a16207", "#4d7c0f"];

export function BoardView({ board, mode, value, onChange, locked, marks }: {
  board: Board; mode: string; value: Record<string, number>; onChange: (v: Record<string, number>) => void; locked: boolean; marks?: Record<string, boolean>;
}) {
  const t = useT();
  const wrap = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [lines, setLines] = useState<{ x1: number; y1: number; x2: number; y2: number; c: string }[]>([]);
  const [drag, setDrag] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  // 本板的连线：leftId -> rightId
  const pairs = board.left.filter((l) => value[l.id] !== undefined).map((l) => [l.id, value[l.id]] as const);
  const rightUsedBy = new Map(pairs.map(([l, r]) => [r, l]));
  const colorOf = (leftId: number) =>
    locked && marks ? (marks[leftId] ? "#1f7a4d" : "#b3261e") : COLORS[board.left.findIndex((l) => l.id === leftId) % COLORS.length];

  const connect = (leftId: number, rightId: number) => {
    const v = { ...value };
    const prev = rightUsedBy.get(rightId);
    if (prev !== undefined) delete v[prev]; // 右边每项只能连一条
    v[leftId] = rightId;
    onChange(v);
    setActive(null);
  };
  const unlinkLeft = (leftId: number) => { const v = { ...value }; delete v[leftId]; onChange(v); };

  const measure = useCallback(() => {
    const w = wrap.current;
    if (!w) return;
    const box = w.getBoundingClientRect();
    const ls = pairs.map(([l, r]) => {
      const a = w.querySelector(`[data-left="${l}"] .dot`)?.getBoundingClientRect();
      const b = w.querySelector(`[data-right="${r}"] .dot`)?.getBoundingClientRect();
      if (!a || !b) return null;
      return { x1: a.left + a.width / 2 - box.left, y1: a.top + a.height / 2 - box.top, x2: b.left + b.width / 2 - box.left, y2: b.top + b.height / 2 - box.top, c: colorOf(l) };
    }).filter(Boolean) as any[];
    setLines(ls);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(pairs), locked, JSON.stringify(marks)]);
  useLayoutEffect(measure, [measure]);
  useEffect(() => {
    window.addEventListener("resize", measure);
    const ro = new ResizeObserver(measure);
    if (wrap.current) ro.observe(wrap.current);
    return () => { window.removeEventListener("resize", measure); ro.disconnect(); };
  }, [measure]);

  // 拖拽连线
  const startDrag = (e: React.PointerEvent, leftId: number) => {
    if (locked) return;
    const w = wrap.current!;
    const box = w.getBoundingClientRect();
    const dot = (e.currentTarget as HTMLElement).querySelector(".dot")!.getBoundingClientRect();
    const x1 = dot.left + dot.width / 2 - box.left, y1 = dot.top + dot.height / 2 - box.top;
    const sx = e.clientX, sy = e.clientY;
    let moved = false;
    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 6) moved = true;
      if (moved) setDrag({ x1, y1, x2: ev.clientX - box.left, y2: ev.clientY - box.top });
    };
    const cancel = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      setDrag(null);
    };
    const up = (ev: PointerEvent) => {
      cancel();
      if (!moved) {
        // 当作点击
        if (value[leftId] !== undefined) unlinkLeft(leftId);
        else setActive((a) => (a === leftId ? null : leftId));
        return;
      }
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest("[data-right]") as HTMLElement | null;
      if (el && wrap.current?.contains(el)) connect(leftId, Number(el.dataset.right));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  };

  const clickRight = (rightId: number) => {
    if (locked) return;
    if (active !== null) return connect(active, rightId);
    const l = rightUsedBy.get(rightId);
    if (l !== undefined) unlinkLeft(l);
  };

  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <p className="muted small" style={{ marginTop: 0 }}>
        {mode === "en_cn"
          ? (board.swap ? t("把中文意思和英文单词连起来。") : t("把英文单词和中文意思连起来。"))
          : (board.swap ? t("把英文释义和对应的单词连起来。") : t("把英文单词和它的英文释义连起来。"))}
        {t("点左边的词再点右边（也可以直接拖过去），点已连好的词可取消。")}
      </p>
      <div className={"match-board" + (board.swap && mode === "en_def" ? " long-left" : "")} ref={wrap}>
        <svg className="match-svg">
          {lines.map((l, i) => <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={l.c} strokeWidth={3} strokeLinecap="round" />)}
          {drag && <line x1={drag.x1} y1={drag.y1} x2={drag.x2} y2={drag.y2} stroke="#888" strokeWidth={2} strokeDasharray="6 4" />}
        </svg>
        <div className="match-col">
          {board.left.map((l) => {
            const linked = value[l.id] !== undefined;
            return (
              <div key={l.id} data-left={l.id} className={"match-item m-left" + (active === l.id ? " active" : "") + (linked ? " linked" : "") + (locked ? " locked" : "")}
                style={linked ? { borderColor: colorOf(l.id) } : {}} onPointerDown={(e) => startDrag(e, l.id)}>
                <span className="match-text">{l.text}{locked && marks && <b style={{ marginLeft: 6, color: colorOf(l.id) }}>{marks[l.id] ? "✓" : "✗"}</b>}</span>
                <span className="dot" style={linked ? { background: colorOf(l.id) } : {}} />
              </div>
            );
          })}
        </div>
        <div className="match-gap" />
        <div className="match-col">
          {board.right.map((r) => {
            const by = rightUsedBy.get(r.id);
            return (
              <div key={r.id} data-right={r.id} className={"match-item m-right" + (by !== undefined ? " linked" : "") + (active !== null ? " target" : "") + (locked ? " locked" : "")}
                style={by !== undefined ? { borderColor: colorOf(by) } : {}} onClick={() => clickRight(r.id)}>
                <span className="dot" style={by !== undefined ? { background: colorOf(by) } : {}} />
                <span className="match-text">{r.text}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <span className="small muted">{t(`已连 ${pairs.length} / ${board.left.length}`)}</span>
        {pairs.length > 0 && !locked && (
          <button type="button" className="btn-ghost btn-sm right" onClick={() => { const v = { ...value }; board.left.forEach((l) => delete v[l.id]); onChange(v); }}>
            {t("清空本组重新连")}
          </button>
        )}
      </div>
    </div>
  );
}
