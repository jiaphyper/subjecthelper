"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useT } from "./I18nProvider";

export interface ConfirmOptions {
  /** 正文。没给 title 时，按第一个问号拆成「标题 + 说明」 */
  message: string;
  title?: string;
  okText?: string;
  cancelText?: string;
  /** 危险操作（删除等）：确定按钮用红色 */
  danger?: boolean;
}
type ConfirmFn = (o: ConfirmOptions | string) => Promise<boolean>;

const Ctx = createContext<ConfirmFn>(async () => false);

/** 全站统一的确认弹窗（替代浏览器自带的 confirm） */
export function useConfirm() {
  return useContext(Ctx);
}

function split(message: string): { title: string; body: string } {
  const m = message.match(/^(.+?[？?])\s*([\s\S]+)$/);
  return m ? { title: m[1], body: m[2] } : { title: message, body: "" };
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const t = useT();
  const [opts, setOpts] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const okRef = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  const confirm = useCallback<ConfirmFn>((o) => {
    const options = typeof o === "string" ? { message: o } : o;
    lastFocus.current = document.activeElement as HTMLElement | null;
    return new Promise<boolean>((resolve) => setOpts({ ...options, resolve }));
  }, []);

  const close = useCallback(
    (v: boolean) => {
      opts?.resolve(v);
      setOpts(null);
      lastFocus.current?.focus?.();
    },
    [opts]
  );

  useEffect(() => {
    if (!opts) return;
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(false); }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [opts, close]);

  const parts = opts ? (opts.title ? { title: opts.title, body: opts.message } : split(opts.message)) : null;

  return (
    <Ctx.Provider value={confirm}>
      {children}
      {opts && parts && (
        <div className="dlg-overlay" onMouseDown={(e) => e.target === e.currentTarget && close(false)}>
          <div className="dlg" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title">
            <div className={"dlg-icon" + (opts.danger ? " danger" : "")} aria-hidden>{opts.danger ? "!" : "?"}</div>
            <div className="dlg-content">
              <h3 id="dlg-title" className="dlg-title">{parts.title}</h3>
              {parts.body && <p className="dlg-body">{parts.body}</p>}
            </div>
            <div className="dlg-actions">
              <button type="button" className="btn-ghost" onClick={() => close(false)}>{opts.cancelText ?? t("取消")}</button>
              <button type="button" ref={okRef} className={opts.danger ? "btn-danger-solid" : ""} onClick={() => close(true)}>
                {opts.okText ?? t("确定")}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
