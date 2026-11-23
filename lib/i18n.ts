import { EN } from "./i18n-en";

export type Lang = "zh" | "en";
export const LANGS: Lang[] = ["zh", "en"];
export const LANG_COOKIE = "sh_lang";

/**
 * 翻译：源码中直接写中文（即 key），英文词典按中文查找。
 * 词典 key 里可以带 {name} 占位符，用来匹配已经拼好的动态文案，如
 *   "还有 {n} 次机会" → "{n} attempts left"
 * 捕获到的片段会再递归翻译一次（如角色名「教师」）。找不到时原样返回。
 */
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PATTERNS = Object.entries(EN)
  .filter(([k]) => /\{\w+\}/.test(k))
  .map(([k, v]) => {
    const names: string[] = [];
    const src = k
      .split(/(\{\w+\})/)
      .map((part) => {
        const m = part.match(/^\{(\w+)\}$/);
        if (m) {
          names.push(m[1]);
          return "([\\s\\S]*?)";
        }
        return esc(part);
      })
      .join("");
    return { re: new RegExp("^" + src + "$"), names, v, weight: k.replace(/\{\w+\}/g, "").length };
  })
  .sort((a, b) => b.weight - a.weight);

export function translate(lang: Lang, s: string): string {
  if (lang === "zh" || !s) return s;
  const hit = EN[s];
  if (hit !== undefined) return hit;
  for (const p of PATTERNS) {
    const m = s.match(p.re);
    if (!m) continue;
    let out = p.v;
    p.names.forEach((n, i) => {
      const cap = m[i + 1];
      // 用「；」拼起来的多条提示逐条翻译
      const tr = cap.includes("；") ? cap.split("；").map((x) => translate(lang, x)).join("; ") : translate(lang, cap);
      out = out.split("{" + n + "}").join(tr);
    });
    return out;
  }
  return s;
}

export type T = (s: string) => string;
export const makeT = (lang: Lang): T => (s: string) => translate(lang, s);
