import { db } from "./db";
import { pick } from "./excel";
import { parseClozeDocx } from "./docx";

export interface BankResult { created: number; errors: string[]; notes: string[] }

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function importMcq(rows: Record<string, string>[], subjectId: number, defaultTag: string): BankResult {
  const res: BankResult = { created: 0, errors: [], notes: [] };
  const ins = db.prepare("INSERT INTO mcq_questions (subject_id, stem, options_json, answer_index, explanation, tag) VALUES (?,?,?,?,?,?)");
  db.transaction(() => {
    rows.forEach((r, i) => {
      const line = i + 2;
      const stem = pick(r, "题干", "题目", "question", "stem");
      const options = LETTERS.map((L) => pick(r, L, "选项" + L, "option " + L, "option" + L));
      while (options.length && !options[options.length - 1]) options.pop();
      if (!stem && !options.length) return;
      if (!stem) return res.errors.push(`第 ${line} 行：缺少题干`);
      if (options.length < 2 || options.some((o) => !o)) return res.errors.push(`第 ${line} 行：选项至少 2 个且不能中间留空`);
      const ansRaw = pick(r, "答案", "answer", "正确答案").toUpperCase();
      let idx = LETTERS.indexOf(ansRaw);
      if (idx < 0 && /^[1-6]$/.test(ansRaw)) idx = Number(ansRaw) - 1;
      if (idx < 0) idx = options.findIndex((o) => o.toUpperCase() === ansRaw);
      if (idx < 0 || idx >= options.length) return res.errors.push(`第 ${line} 行：答案「${ansRaw}」无效`);
      ins.run(subjectId, stem, JSON.stringify(options), idx, pick(r, "解析", "explanation") || null, pick(r, "标签", "tag", "单元") || defaultTag || null);
      res.created++;
    });
  })();
  return res;
}

export function importVocab(rows: Record<string, string>[], subjectId: number, defaultTag: string): BankResult {
  const res: BankResult = { created: 0, errors: [], notes: [] };
  const ins = db.prepare("INSERT INTO vocab (subject_id, word, chinese, definition, example, tag) VALUES (?,?,?,?,?,?)");
  db.transaction(() => {
    rows.forEach((r, i) => {
      const line = i + 2;
      const word = pick(r, "英文", "单词", "word", "english");
      const zh = pick(r, "中文", "chinese", "翻译");
      const def = pick(r, "英文释义", "释义", "definition", "meaning");
      const example = pick(r, "应用", "例句", "example", "usage", "sentence");
      if (!word && !zh && !def) return;
      if (!word) return res.errors.push(`第 ${line} 行：缺少英文单词`);
      if (!zh && !def) return res.errors.push(`第 ${line} 行：${word} 中文和英文释义至少填一个`);
      ins.run(subjectId, word, zh || null, def || null, example || null, pick(r, "标签", "tag", "单元") || defaultTag || null);
      res.created++;
    });
  })();
  return res;
}

export async function importCloze(buf: Buffer, subjectId: number, title: string, tag: string): Promise<BankResult> {
  const res: BankResult = { created: 0, errors: [], notes: [] };
  const { rows, skipped } = await parseClozeDocx(buf);
  if (!rows.length) {
    res.errors.push("没有找到含加粗词的句子。请确认：Word 表格第一列的句子中，需要填空的词设置了加粗。");
    return res;
  }
  db.transaction(() => {
    const setId = db.prepare("INSERT INTO cloze_sets (subject_id, title, tag) VALUES (?,?,?)").run(subjectId, title, tag || null).lastInsertRowid;
    const ins = db.prepare("INSERT INTO cloze_items (set_id, segments_json, distractors_json, sort) VALUES (?,?,?,?)");
    rows.forEach((r, i) => ins.run(setId, JSON.stringify(r.segments), JSON.stringify(r.distractors), i));
  })();
  const blanks = rows.reduce((n, r) => n + r.segments.filter((s) => "b" in s).length, 0);
  const extra = rows.reduce((n, r) => n + r.distractors.length, 0);
  res.created = rows.length;
  res.notes.push(`套题「${title}」：${rows.length} 句，${blanks} 个空，${extra} 个干扰词${skipped ? `；跳过 ${skipped} 行（表头/无加粗）` : ""}`);
  return res;
}
