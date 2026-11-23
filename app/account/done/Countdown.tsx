"use client";
import { useEffect, useState } from "react";
import { useT } from "@/components/I18nProvider";

export default function Countdown({ to, seconds }: { to: string; seconds: number }) {
  const t = useT();
  const [n, setN] = useState(seconds);
  useEffect(() => {
    if (n <= 0) { window.location.replace(to); return; }
    const h = setTimeout(() => setN(n - 1), 1000);
    return () => clearTimeout(h);
  }, [n, to]);
  return (
    <>
      <p className="small muted">{t(`${n} 秒后自动跳转到登录页`)}</p>
      <a className="btn" href={to} style={{ width: "100%", justifyContent: "center" }}>{t("立即登录")}</a>
    </>
  );
}
