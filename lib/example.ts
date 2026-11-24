/** 词汇「应用」（例句）的解析与高亮。前后端共用，不依赖数据库。 */

const QUOTES = /^[\s"“”'‘’「」]+|[\s"“”'‘’「」]+$/g;

/**
 * 单元格里可以换行：第一行英文例句，其余行是中文翻译。
 * 没有换行时，按第一个中文字符拆开（如 "Sound cannot ... vacuum. 声音不能在真空中传播。"）
 */
export function splitExample(raw: string | null | undefined): { en: string; zh: string } | null {
  const s = (raw ?? "").replace(/\r\n?/g, "\n").replace(QUOTES, "").trim();
  if (!s) return null;
  const lines = s.split("\n").map((l) => l.replace(QUOTES, "").trim()).filter(Boolean);
  if (lines.length > 1) return { en: lines[0], zh: lines.slice(1).join(" ") };
  const m = s.match(/^([^一-鿿]*?)\s*([一-鿿][\s\S]*)$/);
  if (m && m[1].trim()) return { en: m[1].trim(), zh: m[2].trim() };
  return { en: s, zh: "" };
}

/** 把句子里的目标词（含 -s/-ed/-ing 等词形变化）标出来 */
export function highlightWord(sentence: string, word: string): { t: string; hit: boolean }[] {
  const w = word.trim();
  if (!w) return [{ t: sentence, hit: false }];
  const esc = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  // 单词结尾的 e / y 在变形时可能变化（make→making，study→studied），去掉末尾一个字母再匹配
  const stem = w.length > 4 && /[ey]$/i.test(w) ? esc.slice(0, -1) : esc;
  const re = new RegExp(`\\b(${stem}[a-z]*)`, "gi");
  const out: { t: string; hit: boolean }[] = [];
  let last = 0;
  for (const m of sentence.matchAll(re)) {
    if (m.index! > last) out.push({ t: sentence.slice(last, m.index), hit: false });
    out.push({ t: m[0], hit: true });
    last = m.index! + m[0].length;
  }
  if (last < sentence.length) out.push({ t: sentence.slice(last), hit: false });
  return out.length ? out : [{ t: sentence, hit: false }];
}

export interface PairExample {
  id: number;
  word: string;
  meaning: string;
  example: string;
  ok: boolean;
}
