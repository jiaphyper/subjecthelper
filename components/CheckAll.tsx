"use client";
import { useT } from "./I18nProvider";
/** 全选/全不选 同一表单内 name=... 的复选框（只作用于可见项） */
export default function CheckAll({ name }: { name: string }) {
  const t = useT();
  const set = (v: boolean, e: React.MouseEvent) => {
    const form = (e.currentTarget as HTMLElement).closest("form");
    form?.querySelectorAll<HTMLInputElement>(`input[type=checkbox][name="${name}"]`).forEach((c) => {
      if (c.offsetParent !== null) c.checked = v;
    });
  };
  return (
    <span className="row" style={{ gap: 4 }}>
      <button type="button" className="btn-ghost btn-sm" onClick={(e) => set(true, e)}>{t("全选")}</button>
      <button type="button" className="btn-ghost btn-sm" onClick={(e) => set(false, e)}>{t("全不选")}</button>
    </span>
  );
}
