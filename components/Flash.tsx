export default function Flash({ ok, err }: { ok?: string; err?: string }) {
  return (
    <>
      {ok && <div className="flash ok">{ok}</div>}
      {err && <div className="flash bad">{err}</div>}
    </>
  );
}
