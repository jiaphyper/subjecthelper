import { db } from "./db";
import { shuffle } from "./util";

/* ---------- 类型 ---------- */
export type MatchMode = "en_cn" | "en_def";
export interface TaskConfig {
  mcq?: { count: number; tags: string[] };
  match?: { count: number; mode: MatchMode; tags: string[] };
  cloze?: { setId: number; count: number };
}
type Seg = { t: string } | { b: string };
/** 发布时冻结的完整题目（含答案），题库后续修改/删除不影响已发布任务 */
export interface TaskContent {
  mcq?: { id: number; stem: string; options: string[]; answer: number; explanation?: string | null }[];
  match?: { mode: MatchMode; pairs: { id: number; left: string; right: string }[] };
  cloze?: { setId: number; title: string; items: { id: number; segments: Seg[]; distractors: string[] }[] };
}
export interface Answers {
  mcq?: Record<string, number>;
  match?: Record<string, number>;      // leftId -> 选中的 right 对应的 pair id
  cloze?: Record<string, (string | null)[]>; // itemId -> 每个空填的词
}
export interface GradeResult {
  mcq?: { id: number; chosen: number | null; answer: number; ok: boolean }[];
  match?: { id: number; chosen: number | null; ok: boolean }[];
  cloze?: { id: number; blanks: { given: string | null; answer: string; ok: boolean }[] }[];
  score: number;
  total: number;
}

const tagFilter = (tags: string[]) =>
  tags.length ? { sql: ` AND tag IN (${tags.map(() => "?").join(",")})`, args: tags } : { sql: "", args: [] as string[] };

/* ---------- 发布：按配置抽题 ---------- */
export function buildContent(subjectId: number, cfg: TaskConfig): { content: TaskContent; warnings: string[] } {
  const content: TaskContent = {};
  const warnings: string[] = [];
  if (cfg.mcq) {
    const f = tagFilter(cfg.mcq.tags);
    const rows = db.prepare(`SELECT * FROM mcq_questions WHERE subject_id=?${f.sql}`).all(subjectId, ...f.args) as any[];
    const picked = shuffle(rows).slice(0, cfg.mcq.count);
    if (picked.length < cfg.mcq.count) warnings.push(`选择题只有 ${picked.length} 道可用`);
    content.mcq = picked.map((q) => ({ id: q.id, stem: q.stem, options: JSON.parse(q.options_json), answer: q.answer_index, explanation: q.explanation }));
  }
  if (cfg.match) {
    const col = cfg.match.mode === "en_cn" ? "chinese" : "definition";
    const f = tagFilter(cfg.match.tags);
    const rows = db.prepare(`SELECT * FROM vocab WHERE subject_id=? AND ${col} IS NOT NULL AND ${col} <> ''${f.sql}`).all(subjectId, ...f.args) as any[];
    // 同一个英文词只取一次
    const seen = new Set<string>();
    const uniq = shuffle(rows).filter((r) => !seen.has(r.word.toLowerCase()) && seen.add(r.word.toLowerCase()));
    const picked = uniq.slice(0, cfg.match.count);
    if (picked.length < cfg.match.count) warnings.push(`连线词汇只有 ${picked.length} 个可用`);
    content.match = { mode: cfg.match.mode, pairs: picked.map((v) => ({ id: v.id, left: v.word, right: v[col] })) };
  }
  if (cfg.cloze) {
    const set = db.prepare("SELECT * FROM cloze_sets WHERE id=? AND subject_id=?").get(cfg.cloze.setId, subjectId) as any;
    if (set) {
      const items = db.prepare("SELECT * FROM cloze_items WHERE set_id=? ORDER BY sort").all(set.id) as any[];
      const n = cfg.cloze.count > 0 ? Math.min(cfg.cloze.count, items.length) : items.length;
      const keep = new Set(shuffle(items).slice(0, n).map((i) => i.id));
      content.cloze = {
        setId: set.id,
        title: set.title,
        items: items.filter((i) => keep.has(i.id)).map((i) => ({ id: i.id, segments: JSON.parse(i.segments_json), distractors: JSON.parse(i.distractors_json) })),
      };
    } else warnings.push("所选填空套题不存在");
  }
  return { content, warnings };
}

export function countItems(c: TaskContent) {
  return {
    mcq: c.mcq?.length ?? 0,
    match: c.match?.pairs.length ?? 0,
    cloze: c.cloze?.items.reduce((n, i) => n + i.segments.filter((s) => "b" in s).length, 0) ?? 0,
  };
}

/* ---------- 学生端看到的版本（不含答案，选项/卡片打乱） ---------- */
export interface PublicContent {
  mcq?: { id: number; stem: string; options: string[] }[];
  match?: { mode: MatchMode; boards: { left: { id: number; text: string }[]; right: { id: number; text: string }[] }[] };
  cloze?: { title: string; items: { id: number; parts: (string | { blank: number })[] }[]; bank: string[] };
}

const BOARD_SIZE = 8;

export function publicContent(c: TaskContent): PublicContent {
  const p: PublicContent = {};
  if (c.mcq) p.mcq = c.mcq.map((q) => ({ id: q.id, stem: q.stem, options: q.options }));
  if (c.match) {
    const boards = [];
    const pairs = shuffle(c.match.pairs);
    for (let i = 0; i < pairs.length; i += BOARD_SIZE) {
      const chunk = pairs.slice(i, i + BOARD_SIZE);
      boards.push({
        left: chunk.map((x) => ({ id: x.id, text: x.left })),
        right: shuffle(chunk.map((x) => ({ id: x.id, text: x.right }))),
      });
    }
    p.match = { mode: c.match.mode, boards };
  }
  if (c.cloze) {
    const bank: string[] = [];
    const items = c.cloze.items.map((it) => {
      let k = 0;
      const parts = it.segments.map((s) => {
        if ("t" in s) return s.t;
        bank.push(s.b);
        return { blank: k++ };
      });
      bank.push(...it.distractors);
      return { id: it.id, parts };
    });
    p.cloze = { title: c.cloze.title, items, bank: shuffle(bank) };
  }
  return p;
}

/* ---------- 判分 ---------- */
const norm = (s: string | null | undefined) => (s ?? "").trim().replace(/\s+/g, " ");

export function grade(c: TaskContent, a: Answers): GradeResult {
  const r: GradeResult = { score: 0, total: 0 };
  if (c.mcq) {
    r.mcq = c.mcq.map((q) => {
      const chosen = a.mcq?.[q.id] ?? null;
      return { id: q.id, chosen, answer: q.answer, ok: chosen === q.answer };
    });
  }
  if (c.match) {
    const rightText = new Map(c.match.pairs.map((p) => [p.id, norm(p.right).toLowerCase()]));
    r.match = c.match.pairs.map((p) => {
      const chosen = a.match?.[p.id] ?? null;
      // 两个词意思相同时，连到任意一个相同释义都算对
      const ok = chosen !== null && rightText.get(chosen) === rightText.get(p.id);
      return { id: p.id, chosen, ok };
    });
  }
  if (c.cloze) {
    r.cloze = c.cloze.items.map((it) => {
      const answers = it.segments.filter((s): s is { b: string } => "b" in s).map((s) => s.b);
      const given = a.cloze?.[it.id] ?? [];
      return {
        id: it.id,
        blanks: answers.map((ans, i) => ({ given: given[i] ?? null, answer: ans, ok: norm(given[i]).toLowerCase() === norm(ans).toLowerCase() })),
      };
    });
  }
  const flags = [
    ...(r.mcq ?? []).map((x) => x.ok),
    ...(r.match ?? []).map((x) => x.ok),
    ...(r.cloze ?? []).flatMap((x) => x.blanks.map((b) => b.ok)),
  ];
  r.total = flags.length;
  r.score = flags.filter(Boolean).length;
  return r;
}

export const pct = (score: number, total: number) => (total ? Math.round((score / total) * 100) : 0);

/* ---------- 逐题校验 ---------- */
/** 一次作答拆成若干「单元」：每道选择题、每组连线、整套填空 */
export function unitKeys(p: PublicContent): string[] {
  return [
    ...(p.mcq ?? []).map((q) => `mcq:${q.id}`),
    ...(p.match?.boards ?? []).map((_, i) => `match:${i}`),
    ...(p.cloze ? ["cloze"] : []),
  ];
}

export interface UnitCheck {
  score: number;
  total: number;
  marks: Record<string, boolean | boolean[]>; // mcq: {id: ok}; match: {leftId: ok}; cloze: {itemId: [ok...]}
}

/** 判一个单元；同时返回需要合并进 Answers 的部分 */
export function gradeUnit(c: TaskContent, layout: PublicContent, unit: string, answer: any): { check: UnitCheck; patch: Answers } | null {
  if (unit.startsWith("mcq:")) {
    const id = Number(unit.slice(4));
    const q = c.mcq?.find((x) => x.id === id);
    if (!q || typeof answer !== "number") return null;
    const ok = answer === q.answer;
    return { check: { score: ok ? 1 : 0, total: 1, marks: { [id]: ok } }, patch: { mcq: { [id]: answer } } };
  }
  if (unit.startsWith("match:")) {
    const board = layout.match?.boards[Number(unit.slice(6))];
    if (!board || !c.match) return null;
    const txt = new Map(c.match.pairs.map((p) => [p.id, norm(p.right).toLowerCase()]));
    const marks: Record<string, boolean> = {};
    const patch: Record<string, number> = {};
    for (const l of board.left) {
      const chosen = answer?.[l.id];
      const valid = typeof chosen === "number" && board.right.some((r) => r.id === chosen);
      marks[l.id] = valid && txt.get(chosen) === txt.get(l.id);
      if (valid) patch[l.id] = chosen;
    }
    const score = Object.values(marks).filter(Boolean).length;
    return { check: { score, total: board.left.length, marks }, patch: { match: patch } };
  }
  if (unit === "cloze" && c.cloze) {
    const marks: Record<string, boolean[]> = {};
    const patch: Record<string, (string | null)[]> = {};
    let score = 0, total = 0;
    for (const it of c.cloze.items) {
      const ans = it.segments.filter((s): s is { b: string } => "b" in s).map((s) => s.b);
      const given: (string | null)[] = Array.isArray(answer?.[it.id]) ? answer[it.id] : [];
      marks[it.id] = ans.map((a, i) => norm(given[i]).toLowerCase() === norm(a).toLowerCase());
      patch[it.id] = ans.map((_, i) => (typeof given[i] === "string" ? given[i] : null));
      score += marks[it.id].filter(Boolean).length;
      total += ans.length;
    }
    return { check: { score, total, marks }, patch: { cloze: patch } };
  }
  return null;
}

export function mergeAnswers(a: Answers, p: Answers): Answers {
  return {
    mcq: { ...(a.mcq ?? {}), ...(p.mcq ?? {}) },
    match: { ...(a.match ?? {}), ...(p.match ?? {}) },
    cloze: { ...(a.cloze ?? {}), ...(p.cloze ?? {}) },
  };
}
