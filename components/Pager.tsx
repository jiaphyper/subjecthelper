import { getT } from "@/lib/i18n-server";

export const PER_PAGE = 30;

/** 读取 ?page=，返回 { page, offset } */
export function pageOf(sp: Record<string, string | undefined>) {
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  return { page, offset: (page - 1) * PER_PAGE };
}

/** 分页条：保留当前筛选参数，只改 page */
export default async function Pager({ path, params, page, total }: {
  path: string; params: Record<string, string | undefined>; page: number; total: number;
}) {
  const t = await getT();
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "page" && k !== "ok" && k !== "err") q.set(k, v);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return path + (s ? "?" + s : "");
  };
  // 显示首页、末页、当前页前后 2 页，其余用 …
  const nums: (number | "…")[] = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 2) nums.push(i);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }
  return (
    <div className="pager">
      <span className="small muted">{t(`共 ${total} 条`)}{pages > 1 ? ` · ${t(`第 ${page} / ${pages} 页`)}` : ""}</span>
      {pages > 1 && (
        <span className="pager-links">
          {page > 1 ? <a className="btn btn-ghost btn-sm" href={href(page - 1)}>{t("‹ 上一页")}</a> : <span className="btn btn-ghost btn-sm disabled">{t("‹ 上一页")}</span>}
          {nums.map((n, i) =>
            n === "…" ? <span key={"e" + i} className="muted small">…</span>
              : <a key={n} href={href(n)} className={"btn btn-sm " + (n === page ? "" : "btn-ghost")}>{n}</a>
          )}
          {page < pages ? <a className="btn btn-ghost btn-sm" href={href(page + 1)}>{t("下一页 ›")}</a> : <span className="btn btn-ghost btn-sm disabled">{t("下一页 ›")}</span>}
        </span>
      )}
    </div>
  );
}
