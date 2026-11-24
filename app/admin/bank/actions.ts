"use server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { str, int, ints, back } from "@/lib/util";

const ret = (fd: FormData) => "/admin/bank?" + str(fd, "_qs");

export async function deleteItems(fd: FormData) {
  await requireRole("admin");
  const kind = str(fd, "kind");
  const table = { mcq: "mcq_questions", vocab: "vocab", cloze: "cloze_sets" }[kind];
  if (!table) back(ret(fd), { err: "类型无效" });
  const ids = ints(fd, "id");
  if (!ids.length) back(ret(fd), { err: "请先勾选要删除的项" });
  const del = db.prepare(`DELETE FROM ${table} WHERE id=?`);
  db.transaction(() => ids.forEach((id) => del.run(id)))();
  back(ret(fd), { ok: `已删除 ${ids.length} 项（已发布任务中的题目会保留在任务快照里，但学生将看不到已删除的题）` });
}

export async function addMcq(fd: FormData) {
  await requireRole("admin");
  const options = ["A", "B", "C", "D", "E", "F"].map((L) => str(fd, "opt" + L)).filter(Boolean);
  const ans = int(fd, "answer") ?? -1;
  if (!str(fd, "stem") || options.length < 2) back(ret(fd), { err: "请填写题干和至少 2 个选项" });
  if (ans < 0 || ans >= options.length) back(ret(fd), { err: "正确答案无效" });
  db.prepare("INSERT INTO mcq_questions (subject_id, stem, options_json, answer_index, explanation, tag) VALUES (?,?,?,?,?,?)")
    .run(int(fd, "subject_id"), str(fd, "stem"), JSON.stringify(options), ans, str(fd, "explanation") || null, str(fd, "tag") || null);
  back(ret(fd), { ok: "已添加选择题" });
}

export async function addVocab(fd: FormData) {
  await requireRole("admin");
  if (!str(fd, "word") || (!str(fd, "chinese") && !str(fd, "definition"))) back(ret(fd), { err: "请填写英文，以及中文或英文释义" });
  db.prepare("INSERT INTO vocab (subject_id, word, chinese, definition, example, tag) VALUES (?,?,?,?,?,?)")
    .run(int(fd, "subject_id"), str(fd, "word"), str(fd, "chinese") || null, str(fd, "definition") || null, str(fd, "example") || null, str(fd, "tag") || null);
  back(ret(fd), { ok: "已添加词汇" });
}
