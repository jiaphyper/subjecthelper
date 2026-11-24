"use client";
import { useState } from "react";
import { useT } from "./I18nProvider";

type Opt = { id: number; name: string };
type Grp = { id: number; name: string; org: string; teacher: string | null };
type Tch = { id: number; name: string; username: string; org: string | null };

/** admin 开放自由练习时的范围选择：全部学生 / 学校 / 组别 / 指定教师（由教师自己选组别） */
export default function AdminScopePicker({ orgs, groups, teachers }: { orgs: Opt[]; groups: Grp[]; teachers: Tch[] }) {
  const t = useT();
  const [scope, setScope] = useState("teacher");
  const radio = (v: string, label: string, extra?: React.ReactNode) => (
    <label className="row" style={{ margin: 0, color: "var(--ink)" }}>
      <input type="radio" name="scope" value={v} checked={scope === v} onChange={() => setScope(v)} /> {label}
      {extra}
    </label>
  );
  return (
    <div className="field">
      <label>{t("开放范围")}</label>
      <div className="stack">
        {radio("teacher", t("指定教师（教师再自己选择开放给哪些组别）"))}
        {radio("group", t("指定组别"))}
        {radio("org", t("某个学校："),
          <select name="org_id" style={{ width: 220 }} disabled={scope !== "org"}>
            <option value="">{t("选择学校…")}</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
        {radio("all", t("全部学生"))}
      </div>
      {scope === "teacher" && (
        <>
          <p className="small muted" style={{ margin: "10px 0 6px" }}>{t("被授权的教师会在自己的「自由练习」页看到这些学科，并选择开放给自己的哪些组别。")}</p>
          <div className="checklist" style={{ maxHeight: 220 }}>
            {teachers.map((x) => (
              <label key={x.id}><input type="checkbox" name="teacher" value={x.id} /> <b>{x.name}</b> <span className="muted small">{x.username}{x.org ? ` · ${x.org}` : ""}</span></label>
            ))}
            {!teachers.length && <div className="muted small">{t("还没有教师")}</div>}
          </div>
        </>
      )}
      {scope === "group" && (
        <div className="checklist" style={{ maxHeight: 220, marginTop: 10 }}>
          {groups.map((g) => (
            <label key={g.id}><input type="checkbox" name="group" value={g.id} /> <b>{g.name}</b> <span className="muted small">{g.org} · {g.teacher ?? "—"}</span></label>
          ))}
          {!groups.length && <div className="muted small">{t("还没有组别")}</div>}
        </div>
      )}
    </div>
  );
}
