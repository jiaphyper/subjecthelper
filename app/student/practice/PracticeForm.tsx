"use client";
import type { SubjectOption } from "@/lib/subjectOptions";
import ContentFields from "@/components/ContentFields";
import { useT } from "@/components/I18nProvider";

export default function PracticeForm({ subjects, limits, action }: { subjects: SubjectOption[]; limits: { mcq: number; match: number }; action: (fd: FormData) => void }) {
  const t = useT();
  return (
    <form action={action} className="card">
      <ContentFields subjects={subjects} limits={limits} />
      <div className="row" style={{ marginTop: 16 }}>
        <button style={{ padding: "10px 24px" }}>{t("生成并开始练习")}</button>
        <span className="small muted">{t(`单次最多 ${limits.mcq} 道选择题、${limits.match} 对连线`)}</span>
      </div>
    </form>
  );
}
