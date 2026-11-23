"use client";
import { createContext, useContext, useMemo } from "react";
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

/** 中 / EN 切换按钮 */
export function LangSwitch({ className = "" }: { className?: string }) {
  const lang = useContext(Ctx);
  const set = (l: Lang) => {
    document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=${365 * 86400}; samesite=lax`;
    window.location.reload();
  };
  return (
    <span className={"lang-switch " + className}>
      <button type="button" className={lang === "zh" ? "on" : ""} onClick={() => set("zh")}>中</button>
      <button type="button" className={lang === "en" ? "on" : ""} onClick={() => set("en")}>EN</button>
    </span>
  );
}
