"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Result { created?: number; updated?: number; errors?: string[]; notes?: string[]; error?: string }

/** 通用文件上传表单：POST 到 endpoint，展示导入结果 */
export default function UploadForm({
  endpoint,
  accept,
  children,
  submitLabel = "上传并导入",
}: {
  endpoint: string;
  accept: string;
  children?: React.ReactNode;
  submitLabel?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const router = useRouter();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setRes(null);
        try {
          const r = await fetch(endpoint, { method: "POST", body: new FormData(e.currentTarget) });
          setRes(await r.json());
          router.refresh();
        } catch (err: any) {
          setRes({ error: String(err) });
        }
        setBusy(false);
      }}
    >
      {children}
      <div className="row field">
        <input type="file" name="file" accept={accept} required />
        <button disabled={busy}>{busy ? "导入中…" : submitLabel}</button>
      </div>
      {res && (
        <div className={"flash " + (res.error || res.errors?.length ? "bad" : "ok")} style={{ whiteSpace: "pre-wrap" }}>
          {res.error ? res.error : (
            <>
              <b>新增 {res.created ?? 0}{res.updated !== undefined ? `，更新 ${res.updated}` : ""}</b>
              {res.notes?.map((n, i) => <div key={"n" + i} className="small">{n}</div>)}
              {!!res.errors?.length && <div style={{ marginTop: 6 }}><b>问题 {res.errors.length} 条：</b>{res.errors.map((e, i) => <div key={i} className="small">{e}</div>)}</div>}
            </>
          )}
        </div>
      )}
    </form>
  );
}
