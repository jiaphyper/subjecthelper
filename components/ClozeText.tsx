type Seg = { t: string } | { b: string };
/** 题库预览：加粗空显示为高亮 */
export default function ClozeText({ segments }: { segments: Seg[] }) {
  return (
    <span>
      {segments.map((s, i) =>
        "t" in s ? <span key={i}>{s.t}</span> : (
          <span key={i} style={{ background: "var(--brand-soft)", color: "var(--brand)", fontWeight: 600, padding: "0 6px", borderRadius: 4, borderBottom: "2px solid var(--brand)" }}>{s.b}</span>
        )
      )}
    </span>
  );
}
