import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { studentTaskState } from "@/lib/studentTask";
import Runner from "@/components/runner/Runner";

export default async function DoTask({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireRole("student");
  const id = Number((await params).id);
  const st = studentTaskState(id, me.id);
  if (!st) notFound();
  const a = st.inProgress;
  if (!a) redirect(`/student/tasks/${id}`);
  let draft = {};
  try { draft = JSON.parse(a.draft_json || "{}"); } catch {}
  return (
    <Runner
      taskId={id}
      attemptId={a.id}
      title={st.task.title}
      attemptNo={a.attempt_no}
      maxAttempts={st.task.max_attempts}
      practice={st.practice}
      content={JSON.parse(a.layout_json)}
      initialChecked={JSON.parse(a.checked_json || "{}")}
      initialDraft={draft}
    />
  );
}
