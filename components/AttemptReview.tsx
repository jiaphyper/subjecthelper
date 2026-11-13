import { TaskContent, GradeResult, Answers } from "@/lib/tasks";

const L = "ABCDEF";
const okStyle = { color: "var(--ok)", fontWeight: 600 };
const badStyle = { color: "var(--bad)", textDecoration: "line-through" };

/** 显示一次作答的批改详情（showAnswers=false 时只标对错，不显示正确答案） */
export default function AttemptReview({ content, result, answers, showAnswers = true }: { content: TaskContent; result: GradeResult; answers: Answers; showAnswers?: boolean }) {
  return (
    <div>
      {content.mcq && result.mcq && (
        <div className="card">
          <h2>选择题 <span className="muted small">{result.mcq.filter((x) => x.ok).length} / {result.mcq.length}</span></h2>
          {content.mcq.map((q, i) => {
            const r = result.mcq!.find((x) => x.id === q.id)!;
            return (
              <div key={q.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                <div>{r.ok ? "✅" : "❌"} <b>{i + 1}.</b> {q.stem}</div>
                <div className="row small" style={{ marginTop: 4, paddingLeft: 24 }}>
                  {q.options.map((o, k) => {
                    const chosen = r.chosen === k;
                    const isAns = showAnswers && k === q.answer;
                    return <span key={k} style={isAns ? okStyle : chosen && !r.ok ? badStyle : chosen ? okStyle : { color: "var(--muted)" }}>{L[k]}. {o}{chosen ? " ←" : ""}</span>;
                  })}
                  {r.chosen === null && <span className="badge bad">未作答</span>}
                </div>
                {showAnswers && q.explanation && <div className="small muted" style={{ paddingLeft: 24 }}>解析：{q.explanation}</div>}
              </div>
            );
          })}
        </div>
      )}
      {content.match && result.match && (
        <div className="card">
          <h2>连线题 <span className="muted small">{result.match.filter((x) => x.ok).length} / {result.match.length}</span></h2>
          <table>
            <tbody>
              {content.match.pairs.map((p) => {
                const r = result.match!.find((x) => x.id === p.id)!;
                const chosenText = content.match!.pairs.find((x) => x.id === r.chosen)?.right;
                return (
                  <tr key={p.id}>
                    <td style={{ width: 30 }}>{r.ok ? "✅" : "❌"}</td>
                    <td><b>{p.left}</b></td>
                    <td>{chosenText ? <span style={r.ok ? okStyle : badStyle}>{chosenText}</span> : <span className="badge bad">未连</span>}</td>
                    {showAnswers && <td className="small" style={okStyle}>{!r.ok && p.right}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {content.cloze && result.cloze && (
        <div className="card">
          <h2>挖空填词 <span className="muted small">{result.cloze.reduce((a, x) => a + x.blanks.filter((b) => b.ok).length, 0)} / {result.cloze.reduce((a, x) => a + x.blanks.length, 0)}</span></h2>
          {content.cloze.items.map((it, i) => {
            const r = result.cloze!.find((x) => x.id === it.id)!;
            let k = 0;
            return (
              <p key={it.id} style={{ lineHeight: 2 }}>
                <span className="muted">{i + 1}. </span>
                {it.segments.map((s, j) => {
                  if ("t" in s) return <span key={j}>{s.t}</span>;
                  const b = r.blanks[k++];
                  return (
                    <span key={j} style={{ padding: "1px 6px", borderRadius: 4, background: b.ok ? "var(--ok-soft)" : "var(--bad-soft)" }}>
                      <span style={b.ok ? okStyle : badStyle}>{b.given || "＿＿"}</span>
                      {!b.ok && showAnswers && <span style={{ ...okStyle, marginLeft: 4 }}>{b.answer}</span>}
                    </span>
                  );
                })}
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
}
