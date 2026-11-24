"use client";
import { highlightWord, splitExample, type PairExample } from "@/lib/example";
import { useT } from "../I18nProvider";

/** 连线校验后显示的「应用」例句：连错的在前 */
export default function ExamplePanel({ items }: { items: PairExample[] }) {
  const t = useT();
  if (!items.length) return null;
  return (
    <div className="ex-panel">
      <div className="ex-head">{t("应用 · 例句")}</div>
      {items.map((x) => {
        const e = splitExample(x.example);
        if (!e) return null;
        return (
          <div key={x.id} className={"ex-item" + (x.ok ? " ok" : " bad")}>
            <div className="ex-word">
              <span className="ex-mark">{x.ok ? "✓" : "✗"}</span>
              <b>{x.word}</b>
              <span className="muted">{x.meaning}</span>
            </div>
            <div className="ex-en">
              {highlightWord(e.en, x.word).map((p, i) => (p.hit ? <mark key={i}>{p.t}</mark> : <span key={i}>{p.t}</span>))}
            </div>
            {e.zh && <div className="ex-zh">{e.zh}</div>}
          </div>
        );
      })}
    </div>
  );
}
