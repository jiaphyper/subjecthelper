import JSZip from "jszip";

export type Segment = { t: string } | { b: string };
export interface ClozeRow {
  segments: Segment[];
  distractors: string[];
}

const decode = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function runIsBold(runXml: string) {
  const rPr = runXml.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/)?.[1] ?? "";
  const m = rPr.match(/<w:b(\s[^>]*)?\/>/);
  if (!m) return false;
  const val = m[1]?.match(/w:val="([^"]*)"/)?.[1];
  return !(val === "0" || val === "false");
}

function runText(runXml: string) {
  let out = "";
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(runXml))) out += m[1] !== undefined ? decode(m[1]) : " ";
  return out;
}

/** 把一个单元格解析成「普通文本 / 加粗(空)」片段 */
function cellSegments(cellXml: string): Segment[] {
  const raw: { bold: boolean; text: string }[] = [];
  const paras = cellXml.match(/<w:p[\s>][\s\S]*?<\/w:p>/g) ?? [];
  paras.forEach((p, pi) => {
    if (pi > 0) raw.push({ bold: false, text: " " });
    const runs = p.match(/<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g) ?? [];
    for (const r of runs) raw.push({ bold: runIsBold(r), text: runText(r) });
  });
  // 合并相邻同类
  const merged: { bold: boolean; text: string }[] = [];
  for (const r of raw) {
    if (!r.text) continue;
    const last = merged[merged.length - 1];
    if (last && last.bold === r.bold) last.text += r.text;
    else merged.push({ ...r });
  }
  // 加粗片段的首尾空格、纯标点 → 归为普通文本
  const segs: Segment[] = [];
  const pushText = (t: string) => {
    if (!t) return;
    const last = segs[segs.length - 1];
    if (last && "t" in last) last.t += t;
    else segs.push({ t });
  };
  for (const m of merged) {
    if (!m.bold) { pushText(m.text); continue; }
    const lead = m.text.match(/^\s*/)![0];
    const trail = m.text.match(/\s*$/)![0];
    const core = m.text.trim();
    pushText(lead);
    if (core && /[\p{L}\p{N}]/u.test(core)) segs.push({ b: core });
    else pushText(core);
    pushText(trail);
  }
  // 规范空白
  return segs.map((s) => ("t" in s ? { t: s.t.replace(/\s+/g, " ") } : s));
}

function cellPlain(cellXml: string) {
  return cellSegments(cellXml).map((s) => ("t" in s ? s.t : s.b)).join("").trim();
}

/** 解析 Word：取所有表格的行；第一列含加粗词的行为题目，第二列为干扰词 */
export async function parseClozeDocx(buf: Buffer): Promise<{ rows: ClozeRow[]; skipped: number }> {
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) throw new Error("不是有效的 .docx 文件");
  const rows: ClozeRow[] = [];
  let skipped = 0;
  const trs = xml.match(/<w:tr[\s>][\s\S]*?<\/w:tr>/g) ?? [];
  if (trs.length) {
    for (const tr of trs) {
      const tcs = tr.match(/<w:tc[\s>][\s\S]*?<\/w:tc>/g) ?? [];
      if (!tcs.length) continue;
      const segments = cellSegments(tcs[0]);
      const hasBlank = segments.some((s) => "b" in s);
      const hasText = segments.some((s) => "t" in s && s.t.trim());
      if (!hasBlank || !hasText) { skipped++; continue; } // 表头（整格加粗）或没有空的行
      const distractors = tcs
        .slice(1)
        .map(cellPlain)
        .join(",")
        .split(/[,，;；、\/]/)
        .map((s) => s.trim())
        .filter(Boolean);
      rows.push({ segments, distractors });
    }
  } else {
    // 没有表格：每个含加粗词的段落作为一题
    const paras = xml.match(/<w:p[\s>][\s\S]*?<\/w:p>/g) ?? [];
    for (const p of paras) {
      const segments = cellSegments(p);
      if (segments.some((s) => "b" in s)) rows.push({ segments, distractors: [] });
    }
  }
  return { rows, skipped };
}

/** 生成一个示例 Word 模板 */
export async function clozeTemplateDocx(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
  );
  const run = (t: string, bold = false) =>
    `<w:r>${bold ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t xml:space="preserve">${esc(t)}</w:t></w:r>`;
  const cell = (runs: string, w = 6000) =>
    `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/></w:tcPr><w:p>${runs}</w:p></w:tc>`;
  const rows: [string, string][] = [
    [run("内容（加粗的词 = 需要填空）", true), run("多出的词（干扰项）", true)],
    [run("The cat sat on the ") + run("mat", true) + run("."), run("hat")],
    [run("She ") + run("quickly", true) + run(" finished her ") + run("homework", true) + run("."), run("slowly")],
    [run("Water ") + run("boils", true) + run(" at 100 °C."), run("freezes")],
  ];
  const tbl =
    `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="9000" w:type="dxa"/><w:tblBorders>` +
    ["top", "left", "bottom", "right", "insideH", "insideV"].map((b) => `<w:${b} w:val="single" w:sz="4" w:color="999999"/>`).join("") +
    `</w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="6000"/><w:gridCol w:w="3000"/></w:tblGrid>` +
    rows.map(([a, b]) => `<w:tr>${cell(a)}${cell(b, 3000)}</w:tr>`).join("") +
    `</w:tbl>`;
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p>${run("挖空填词模板：第一列为句子，加粗部分为空；第二列为额外的干扰词。所有加粗词 + 干扰词组成 word bank。第一行表头会被自动忽略。")}</w:p>${tbl}<w:p/><w:sectPr/></w:body></w:document>`
  );
  return zip.generateAsync({ type: "nodebuffer" });
}
