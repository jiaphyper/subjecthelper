"use client";
import { useRef, useState } from "react";

type Data = { title: string; items: { id: number; parts: (string | { blank: number })[] }[]; bank: string[] };
export type Place = Record<string, number>; // "itemId:k" -> bank card index

export default function Cloze({ data, place, setPlace, locked, marks }: {
  data: Data; place: Place; setPlace: (p: Place) => void; locked: boolean; marks?: Record<string, boolean[]>;
}) {
  const [selected, setSelected] = useState<number | null>(null); // 点击模式选中的卡片
  const [drag, setDrag] = useState<{ card: number; x: number; y: number; from: string | null } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const placeRef = useRef(place);
  placeRef.current = place;

  const used = new Set(Object.values(place));
  const cardAt = (key: string) => place[key];

  const putCard = (card: number, key: string | null, from: string | null) => {
    const p = { ...placeRef.current };
    if (from) delete p[from];
    if (key) {
      const existing = p[key];
      if (existing !== undefined && from) p[from] = existing; // 两个空互换
      p[key] = card;
    }
    setPlace(p);
    setSelected(null);
  };

  const startDrag = (e: React.PointerEvent, card: number, from: string | null) => {
    e.preventDefault();
    if (locked) return;
    const sx = e.clientX, sy = e.clientY;
    let moved = false;
    const move = (ev: PointerEvent) => {
      if (!moved && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 6) moved = true;
      if (moved) {
        setDrag({ card, x: ev.clientX, y: ev.clientY, from });
        const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest("[data-blank]") as HTMLElement | null;
        setHover(el?.dataset.blank ?? null);
      }
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDrag(null);
      setHover(null);
      if (!moved) {
        // 点击：空里的卡片 → 退回 word bank；bank 里的卡片 → 选中
        if (from) putCard(card, null, from);
        else setSelected((s) => (s === card ? null : card));
        return;
      }
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest("[data-blank]") as HTMLElement | null;
      if (el) putCard(card, el.dataset.blank!, from);
      else if (from) putCard(card, null, from); // 拖出空格 → 退回 bank
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const clickBlank = (key: string) => {
    if (locked) return;
    if (selected !== null) putCard(selected, key, null);
  };

  return (
    <div>
      <p className="muted small" style={{ marginTop: 0 }}>把下方 word bank 中的卡片拖到空格里（或先点卡片、再点空格）。点空格里的词可以把它退回。注意：有多余的干扰词。</p>
      <div className="bank">
        <div className="small muted" style={{ marginBottom: 6 }}>Word bank · 剩余 {data.bank.length - used.size} 张</div>
        <div className="bank-cards">
          {data.bank.map((w, i) =>
            used.has(i) ? null : (
              <span key={i} className={"word-card" + (selected === i ? " sel" : "") + (drag?.card === i ? " ghosted" : "")} onPointerDown={(e) => startDrag(e, i, null)}>
                {w}
              </span>
            )
          )}
          {used.size === data.bank.length && <span className="muted small">卡片都用完了</span>}
        </div>
      </div>
      <div className="card cloze-text">
        {data.items.map((it, n) => (
          <p key={it.id}>
            <span className="muted">{n + 1}. </span>
            {it.parts.map((p, j) => {
              if (typeof p === "string") return <span key={j}>{p}</span>;
              const key = `${it.id}:${p.blank}`;
              const c = cardAt(key);
              const mk = locked && marks ? marks[it.id]?.[p.blank] : undefined;
              return (
                <span key={j} data-blank={key} className={"blank" + (c !== undefined ? " filled" : "") + (hover === key ? " hover" : "") + (selected !== null && c === undefined ? " ready" : "") + (mk === true ? " ok" : mk === false ? " bad" : "")}
                  onClick={() => clickBlank(key)}>
                  {c !== undefined ? (
                    <span className={"word-card in-blank" + (drag?.card === c ? " ghosted" : "")} onPointerDown={(e) => { e.stopPropagation(); startDrag(e, c, key); }}>
                      {data.bank[c]}
                    </span>
                  ) : " "}
                </span>
              );
            })}
          </p>
        ))}
      </div>
      {Object.keys(place).length > 0 && !locked && (
        <button type="button" className="btn-ghost btn-sm" onClick={() => setPlace({})}>全部清空重来</button>
      )}
      {drag && (
        <span className="word-card dragging" style={{ left: drag.x, top: drag.y }}>{data.bank[drag.card]}</span>
      )}
    </div>
  );
}
