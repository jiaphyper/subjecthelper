"use client";
import { useState, useTransition } from "react";
import type { SubjectOption } from "@/lib/subjectOptions";
import ContentFields from "@/components/ContentFields";
import { useT } from "@/components/I18nProvider";

interface Grp { id: number; name: string; members: number[]; mine: number[] }
type Action = (fd: FormData) => Promise<{ error?: string } | void>;

export default function TaskForm({ subjects, groups, action }: { subjects: SubjectOption[]; groups: Grp[]; action: Action }) {
  const t = useT();
  const [title, setTitle] = useState("");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [onlyMine, setOnlyMine] = useState(false);
  const [contentIssues, setContentIssues] = useState<string[]>([]);
  const [serverError, setServerError] = useState("");
  const [pending, startTransition] = useTransition();
  const toggle = (id: number) => {
    const n = new Set(picked);
    n.has(id) ? n.delete(id) : n.add(id);
    setPicked(n);
  };
  // 多个组里重复的学生只算一次
  const recipients = new Set(groups.filter((g) => picked.has(g.id)).flatMap((g) => (onlyMine ? g.mine : g.members))).size;

  /* ---------- 前端检查：不通过时 Publish 置灰，并列出还差什么 ---------- */
  let groupIssue = "";
  if (!picked.size) groupIssue = "请至少勾选一个组别";
  else if (!recipients)
    groupIssue = onlyMine
      ? "这些组里没有绑定给你的学生。可以取消勾选「只发给组内绑定给我的学生」，或先到「我的学生」绑定"
      : "所选组别中没有学生";
  const issues = [...(title.trim() ? [] : ["请填写任务名称"]), ...contentIssues, ...(groupIssue ? [groupIssue] : [])];
  const blocked = issues.length > 0 || pending;

  /** 不用 <form action>：React 19 会在提交后重置表单。这里手动调用，出错时保留已填内容 */
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (blocked) return;
    const fd = new FormData(e.currentTarget);
    setServerError("");
    startTransition(async () => {
      const r = await action(fd);
      if (r && r.error) setServerError(t(r.error));
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="card">
        <div className="grid3">
          <div style={{ gridColumn: "span 3" }}>
            <label>{t("任务名称 *")}</label>
            <input type="text" name="title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("如：Unit 1 词汇练习")} />
          </div>
          <div><label>{t("每人可尝试次数")}</label><input type="number" name="max_attempts" defaultValue={3} min={1} max={10} /></div>
          <div><label>{t("截止时间（可选）")}</label><input type="datetime-local" name="due_at" /></div>
        </div>
      </div>

      <div className="card">
        <ContentFields subjects={subjects} onIssues={setContentIssues} />
      </div>

      <div className={"card" + (groupIssue && picked.size ? " card-warn" : "")}>
        <h2>{t("发布给哪些组别")}</h2>
        <label className="row" style={{ color: "var(--ink)", marginBottom: 8 }}>
          <input type="checkbox" name="only_mine" value="1" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> {t("只发给组内绑定给我的学生")}
        </label>
        <div className="checklist">
          {groups.map((g) => (
            <label key={g.id}>
              <input type="checkbox" name="group" value={g.id} checked={picked.has(g.id)} onChange={() => toggle(g.id)} />
              <b>{g.name}</b>
              <span className="muted small">{t(`${g.members.length} 人`)} · {t(`我的学生 ${g.mine.length} 人`)}</span>
            </label>
          ))}
          {!groups.length && <div className="muted small">{t("你还没有组别，请先到「组别」页面创建。")}</div>}
        </div>
        <p className="small muted">{t(`预计接收：${recipients} 人（多个组中重复的学生只算一次）`)}</p>
        {groupIssue && picked.size > 0 && <div className="field-error">{t(groupIssue)}</div>}
      </div>

      {serverError && <div className="flash bad">{serverError}</div>}
      <div className="row submit-row">
        <button type="submit" disabled={blocked} style={{ padding: "10px 24px" }}>{pending ? t("发布中…") : t("发布任务")}</button>
        {issues.length > 0 && !pending && (
          <div className="small submit-hint">
            <b>{t("发布前还需要：")}</b>
            <ul>{issues.map((x) => <li key={x}>{t(x)}</li>)}</ul>
          </div>
        )}
      </div>
    </form>
  );
}
