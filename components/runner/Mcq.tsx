"use client";
const L = "ABCDEF";

export default function McqQuestion({ q, value, onChange, locked, mark }: {
  q: { id: number; stem: string; options: string[] }; value: number | undefined; onChange: (v: number) => void; locked: boolean; mark?: boolean;
}) {
  return (
    <div className="card">
      <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 17 }}>{q.stem}</div>
      <div className="mcq-options">
        {q.options.map((o, k) => {
          const sel = value === k;
          const cls = sel ? (locked ? (mark ? " right-ans" : " wrong-ans") : " sel") : "";
          return (
            <button type="button" key={k} disabled={locked && !sel} className={"mcq-opt" + cls} onClick={() => !locked && onChange(k)}>
              <span className="mcq-letter">{L[k]}</span> {o} {sel && locked && <span className="right">{mark ? "✓" : "✗"}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
