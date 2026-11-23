"use client";
import { useState } from "react";
import type { SubjectOption } from "@/lib/subjectOptions";
import ContentFields from "@/components/ContentFields";
import { useT } from "@/components/I18nProvider";

interface Grp { id: number; name: string; members: number[]; mine: number[] }

export default function TaskForm({ subjects, groups, action }: { subjects: SubjectOption[]; groups: Grp[]; action: (fd: FormData) => void }) {
  const t = useT();
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [onlyMine, setOnlyMine] = useState(false);
  const toggle = (id: number) => {
    const n = new Set(picked);
    n.has(id) ? n.delete(id) : n.add(id);
    setPicked(n);
  };
  // 多个组里重复的学生只算一次
  const recipients = new Set(groups.filter((g) => picked.has(g.id)).flatMap((g) => (onlyMine ? g.mine : g.members))).size;

  return (
    <form action={action}>
      <div className="card">
        <div className="grid3">
          <div style={{ gridColumn: "span 3" }}><label>{t("任务名称 *")}</label><input type="text" name="title" required placeholder={t("如：Unit 1 词汇练习")} /></div>
          <div><label>{t("每人可尝试次数")}</label><input type="number" name="max_attempts" defaultValue={3} min={1} max={10} /></div>
          <div><label>{t("截止时间（可选）")}</label><input type="datetime-local" name="due_at" /></div>
        </div>
      </div>

      <div className="card">
        <ContentFields subjects={subjects} />
      </div>

      <div className="card">
        <h2>{t("发布给哪些组别")}</h2>
        <label className="row" style={{ color: "var(--ink)", marginBottom: 8 }}>
          <input type="checkbox" name="only_mine" value="1" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> {t("只发给组内绑定给我的学生")}
        </label>
        <div className="checklist">
          {groups.map((g) => (
            <label key={g.id}>
              <input type="checkbox" name="group" value={g.id} checked={picked.has(g.id)} onChange={() => toggle(g.id)} />
              <b>{g.name}</b>
              <span className="muted small">{t(`${g.members.length} 人`)}{g.mine.length !== g.members.length ? t(`（我的学生 ${g.mine.length}）`) : ""}</span>
            </label>
          ))}
          {!groups.length && <div className="muted small">{t("你还没有组别，请先到「组别」页面创建。")}</div>}
        </div>
        <p className="small muted">{t(`预计接收：${recipients} 人（多个组中重复的学生只算一次）`)}</p>
      </div>
      <button style={{ padding: "10px 24px" }}>{t("发布任务")}</button>
    </form>
  );
}
