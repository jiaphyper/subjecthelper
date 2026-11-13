import * as XLSX from "xlsx";

/** 读取第一个工作表，返回以表头为 key 的行对象 */
export function readSheet(buf: Buffer): Record<string, string>[] {
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "", raw: false });
  return rows.map((r) => {
    const o: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) o[String(k).trim()] = String(v ?? "").trim();
    return o;
  });
}

/** 按多个可能的表头名取值 */
export function pick(row: Record<string, string>, ...keys: string[]) {
  for (const k of keys) {
    for (const rk of Object.keys(row)) {
      if (rk.toLowerCase() === k.toLowerCase() && row[rk] !== "") return row[rk];
    }
  }
  return "";
}

export function splitList(s: string) {
  return s.split(/[,，;；、\n]/).map((x) => x.trim()).filter(Boolean);
}

export function makeWorkbook(sheetName: string, rows: any[][], widths?: number[]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  if (widths) ws["!cols"] = widths.map((w) => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
