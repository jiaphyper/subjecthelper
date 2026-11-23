"use client";
import { createContext, useContext, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lang, makeT, LANG_COOKIE } from "@/lib/i18n";

const Ctx = createContext<Lang>("zh");

export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <Ctx.Provider value={lang}>{children}</Ctx.Provider>;
}

export function useLang() {
  return useContext(Ctx);
}

export function useT() {
  const lang = useContext(Ctx);
  return useMemo(() => makeT(lang), [lang]);
}

/** 中 / EN 切换按钮：不整页刷新，只让服务端重新渲染文字，页面上已填的内容会保留 */
export function LangSwitch({ className = "" }: { className?: string }) {
  const lang = useContext(Ctx);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const set = (l: Lang) => {
    if (l === lang || pending) return;
    document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=${365 * 86400}; samesite=lax`;
    document.documentElement.lang = l === "en" ? "en" : "zh-CN";
    startTransition(() => router.refresh());
  };
  return (
    <span className={"lang-switch " + className + (pending ? " pending" : "")}>
      <button type="button" className={lang === "zh" ? "on" : ""} onClick={() => set("zh")}>中</button>
      <button type="button" className={lang === "en" ? "on" : ""} onClick={() => set("en")}>EN</button>
    </span>
  );
}
