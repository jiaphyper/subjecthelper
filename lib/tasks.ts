import { db } from "./db";
import { shuffle } from "./util";

/* ---------- 类型 ---------- */
export type MatchMode = "en_cn" | "en_def";
export const MATCH_MODES: MatchMode[] = ["en_cn", "en_def"];
export interface TaskConfig {
  mcq?: { count: number; tags: string[] };
  /** modes 可多选；旧数据只有 mode */
  match?: { count: number; modes?: MatchMode[]; mode?: MatchMode; tags: string[]; swap?: boolean };
  cloze?: { setId: number; count: number };
}
type Seg = { t: string } | { b: string };
export interface MatchPair { id: number; left: string; right: string; mode?: MatchMode }
/** 发布时冻结的完整题目（含答案），题库后续修改/删除不影响已发布任务 */
export interface TaskContent {
  mcq?: { id: number; stem: string; options: string[]; answer: number; explanation?: string | null }[];
  /** left 永远是英文；right 是中文或英文释义（由 pair.mode 决定）。mode 为旧版整组统一的模式 */
  match?: { mode?: MatchMode; swap?: boolean; pairs: MatchPair[] };
  cloze?: { setId: number; title: string; items: { id: number; segments: Seg[]; distractors: string[] }[] };
}
export interface Answers {
  mcq?: Record<string, number>;          // 题目 id -> 原始选项下标
  match?: Record<string, number>;        // leftId -> 选中的 right 对应的 pair id
  cloze?: Record<string, (string | null)[]>; // itemId -> 每个空填的词
}
export interface GradeResult {
  mcq?: { id: number; chosen: number | null; answer: number; ok: boolean }[];
  match?: { id: number; chosen: number | null; ok: boolean }[];
  cloze?: { id: number; blanks: { given: string | null; answer: string; ok: boolean }[] }[];
  score: number;
  total: number;
}

export const configModes = (m: NonNullable<TaskConfig["match"]>): MatchMode[] => (m.modes?.length ? m.modes : [m.mode ?? "en_cn"]);
export const pairMode = (c: TaskContent, p: MatchPair): MatchMode => p.mode ?? c.match?.mode ?? "en_cn";

const tagFilter = (tags: string[]) =>
  tags.length ? { sql: ` AND tag IN (${tags.map(() => "?").join(",")})`, args: tags } : { sql: "", args: [] as string[] };
const filled = (s: unknown) => typeof s === "string" && s.trim() !== "";

/* ---------- 表单 → 配置 ---------- */
export const LIMITS = { mcq: 200, match: 200 };

/** 解析教师布置 / 学生组卷表单中的题型部分。返回错误文案（中文 key，界面层再翻译） */
export function parseConfig(fd: FormData, limits = LIMITS): { cfg: TaskConfig; error?: string } {
  const num = (k: string) => {
    const v = parseInt(String(fd.get(k) ?? ""), 10);
    return Number.isFinite(v) ? v : null;
  };
  const types = fd.getAll("type").map(String);
  const cfg: TaskConfig = {};
  if (!types.length) return { cfg, error: "请至少勾选一种题型" };
  if (types.includes("mcq"))
    cfg.mcq = { count: Math.min(limits.mcq, Math.max(1, num("mcq_count") ?? 10)), tags: fd.getAll("mcq_tags").map(String) };
  if (types.includes("match")) {
    const modes = fd.getAll("match_mode").map(String).filter((m): m is MatchMode => (MATCH_MODES as string[]).includes(m));
    if (!modes.length) return { cfg, error: "连线题请至少勾选一种连线方式" };
    cfg.match = {
      count: Math.min(limits.match, Math.max(2, num("match_count") ?? 8)),
      modes,
      tags: fd.getAll("match_tags").map(String),
      swap: fd.get("match_swap") === "1",
    };
  }
  if (types.includes("cloze")) {
    const setId = num("cloze_set");
    if (!setId) return { cfg, error: "请选择填空套题" };
    cfg.cloze = { setId, count: num("cloze_count") ?? 0 };
  }
  return { cfg };
}

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
    const modes = configModes(cfg.match);
    const f = tagFilter(cfg.match.tags);
    const rows = db.prepare(`SELECT * FROM vocab WHERE subject_id=?${f.sql}`).all(subjectId, ...f.args) as any[];
    const can = (r: any, m: MatchMode) => (m === "en_cn" ? filled(r.chinese) : filled(r.definition));
    // 没有英文释义的词不会进入「英-释义」；所选范围内完全没有释义时给出提示
    for (const m of modes) {
      if (!rows.some((r) => can(r, m)))
        warnings.push(m === "en_def" ? "所选范围的词汇没有英文释义，已跳过「英文—英文释义」" : "所选范围的词汇没有中文，已跳过「英文—中文」");
    }
    // 同一个英文词只取一次
    const seen = new Set<string>();
    const uniq = shuffle(rows.filter((r) => modes.some((m) => can(r, m)))).filter((r) => {
      const k = String(r.word).trim().toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const picked = uniq.slice(0, cfg.match.count);
    if (picked.length < cfg.match.count) warnings.push(`连线词汇只有 ${picked.length} 个可用`);
    // 多种模式时尽量平均分配；某个词只有一种数据时只能用那种
    const used: Record<MatchMode, number> = { en_cn: 0, en_def: 0 };
    const pairs: MatchPair[] = picked.map((v) => {
      const avail = modes.filter((m) => can(v, m));
      const mode = avail.length === 1 ? avail[0] : avail.reduce((a, b) => (used[b] < used[a] ? b : a));
      used[mode]++;
      return { id: v.id, left: v.word, right: mode === "en_cn" ? v.chinese : v.definition, mode };
    });
    content.match = { swap: !!cfg.match.swap, pairs };
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

/** 任务里实际用到的连线模式 */
export function contentModes(c: TaskContent): MatchMode[] {
  if (!c.match) return [];
  return MATCH_MODES.filter((m) => c.match!.pairs.some((p) => pairMode(c, p) === m));
}

/* ---------- 学生端看到的版本（不含答案）：每次作答重新打乱顺序 ---------- */
export interface PublicBoard { mode?: MatchMode; /** true = 本组左右中英混排 */ swap?: boolean; left: { id: number; text: string }[]; right: { id: number; text: string }[] }
export interface PublicContent {
  /** perm[显示位置] = 原始选项下标 */
  mcq?: { id: number; stem: string; options: string[]; perm?: number[] }[];
  match?: { mode?: MatchMode; boards: PublicBoard[] };
  cloze?: { title: string; items: { id: number; parts: (string | { blank: number })[] }[]; bank: string[] };
}

const BOARD_SIZE = 8;
/** 含这些字样的选项依赖位置（如 All of the above），这类题不打乱选项 */
const FIXED_OPTION = /all of the above|none of the above|both (a|b)|neither|above|以上|都(对|不对|正确|错误)|A和B|A 和 B/i;

export function publicContent(c: TaskContent): PublicContent {
  const p: PublicContent = {};
  if (c.mcq) {
    p.mcq = shuffle(c.mcq).map((q) => {
      const idx = q.options.map((_, i) => i);
      const perm = q.options.some((o) => FIXED_OPTION.test(o)) ? idx : shuffle(idx);
      return { id: q.id, stem: q.stem, options: perm.map((i) => q.options[i]), perm };
    });
  }
  if (c.match) {
    const boards: PublicBoard[] = [];
    for (const mode of contentModes(c)) {
      const pairs = shuffle(c.match.pairs.filter((x) => pairMode(c, x) === mode));
      for (let i = 0; i < pairs.length; i += BOARD_SIZE) {
        const chunk = pairs.slice(i, i + BOARD_SIZE);
        // 左右随机：同一组里约一半的词对交换左右（左边一列中英混排），每次作答重新随机。
        // 旧任务没有 swap 字段，也默认开启；只有教师明确取消勾选（swap=false）才固定英文在左
        const mix = c.match.swap !== false && chunk.length >= 2;
        let flipped = new Set<number>();
        if (mix) {
          const n = Math.max(1, Math.min(chunk.length - 1, Math.round(chunk.length * (0.3 + Math.random() * 0.4))));
          flipped = new Set(shuffle(chunk.map((x) => x.id)).slice(0, n));
        }
        boards.push({
          mode,
          swap: mix,
          left: shuffle(chunk.map((x) => ({ id: x.id, text: flipped.has(x.id) ? x.right : x.left }))),
          right: shuffle(chunk.map((x) => ({ id: x.id, text: flipped.has(x.id) ? x.left : x.right }))),
        });
      }
    }
    p.match = { boards: shuffle(boards) };
  }
  if (c.cloze) {
    const bank: string[] = [];
    const items = shuffle(c.cloze.items).map((it) => {
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

export const boardMode = (p: PublicContent, b: PublicBoard): MatchMode => b.mode ?? p.match?.mode ?? "en_cn";

/* ---------- 判分 ---------- */
const norm = (s: string | null | undefined) => (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();

/** 连线是否正确：连到同一对，或两边显示的文字完全相同（同义词/同形词，学生无法区分） */
function matchOk(c: TaskContent, leftId: number, chosen: number | null | undefined) {
  if (chosen === null || chosen === undefined) return false;
  if (chosen === leftId) return true;
  const a = c.match?.pairs.find((p) => p.id === leftId);
  const b = c.match?.pairs.find((p) => p.id === chosen);
  if (!a || !b) return false;
  return norm(a.left) === norm(b.left) || norm(a.right) === norm(b.right);
}

export function grade(c: TaskContent, a: Answers): GradeResult {
  const r: GradeResult = { score: 0, total: 0 };
  if (c.mcq) {
    r.mcq = c.mcq.map((q) => {
      const chosen = a.mcq?.[q.id] ?? null;
      return { id: q.id, chosen, answer: q.answer, ok: chosen === q.answer };
    });
  }
  if (c.match) {
    r.match = c.match.pairs.map((p) => {
      const chosen = a.match?.[p.id] ?? null;
      return { id: p.id, chosen, ok: matchOk(c, p.id, chosen) };
    });
  }
  if (c.cloze) {
    r.cloze = c.cloze.items.map((it) => {
      const answers = it.segments.filter((s): s is { b: string } => "b" in s).map((s) => s.b);
      const given = a.cloze?.[it.id] ?? [];
      return {
        id: it.id,
        blanks: answers.map((ans, i) => ({ given: given[i] ?? null, answer: ans, ok: norm(given[i]) === norm(ans) })),
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

/** 判一个单元；同时返回需要合并进 Answers 的部分。mcq 的 answer 是「显示位置」 */
export function gradeUnit(c: TaskContent, layout: PublicContent, unit: string, answer: any): { check: UnitCheck; patch: Answers } | null {
  if (unit.startsWith("mcq:")) {
    const id = Number(unit.slice(4));
    const q = c.mcq?.find((x) => x.id === id);
    const lq = layout.mcq?.find((x) => x.id === id);
    if (!q || !Number.isInteger(answer) || answer < 0 || answer >= q.options.length) return null;
    const orig = lq?.perm ? lq.perm[answer] : answer;
    const ok = orig === q.answer;
    return { check: { score: ok ? 1 : 0, total: 1, marks: { [id]: ok } }, patch: { mcq: { [id]: orig } } };
  }
  if (unit.startsWith("match:")) {
    const board = layout.match?.boards[Number(unit.slice(6))];
    if (!board || !c.match) return null;
    const marks: Record<string, boolean> = {};
    const patch: Record<string, number> = {};
    for (const l of board.left) {
      const chosen = answer?.[l.id];
      const valid = typeof chosen === "number" && board.right.some((r) => r.id === chosen);
      marks[l.id] = valid && matchOk(c, l.id, chosen);
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
      marks[it.id] = ans.map((a, i) => norm(given[i]) === norm(a));
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
