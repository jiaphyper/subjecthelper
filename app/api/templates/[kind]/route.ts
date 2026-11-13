import { currentUser } from "@/lib/auth";
import { makeWorkbook } from "@/lib/excel";
import { clozeTemplateDocx } from "@/lib/docx";

const TEMPLATES: Record<string, { file: string; sheet: string; rows: any[][]; widths: number[] }> = {
  users: {
    file: "账号导入模板.xlsx",
    sheet: "账号",
    widths: [14, 10, 8, 10, 16],
    rows: [
      ["用户名", "姓名", "角色", "密码", "学校"],
      ["t_wang", "王老师", "教师", "", "示例学校"],
      ["s001", "张三", "学生", "", "示例学校"],
      ["s002", "李四", "学生", "", "示例学校"],
    ],
  },
  mcq: {
    file: "选择题导入模板.xlsx",
    sheet: "选择题",
    widths: [50, 18, 18, 18, 18, 8, 30, 12],
    rows: [
      ["题干", "A", "B", "C", "D", "答案", "解析", "标签"],
      ["Which word means 'happy'?", "sad", "glad", "angry", "tired", "B", "glad = happy", "Unit 1"],
      ["What is the SI unit of force?", "joule", "watt", "newton", "pascal", "C", "", "Mechanics"],
    ],
  },
  vocab: {
    file: "词汇导入模板.xlsx",
    sheet: "词汇",
    widths: [18, 18, 50, 12],
    rows: [
      ["英文", "中文", "英文释义", "标签"],
      ["apple", "苹果", "a round fruit with red or green skin", "Unit 1"],
      ["velocity", "速度", "speed in a given direction", "Mechanics"],
    ],
  },
};

export async function GET(_req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const me = await currentUser();
  if (!me || me.role === "student") return new Response("Forbidden", { status: 403 });
  const { kind } = await params;
  let body: Buffer, file: string, type: string;
  if (kind === "cloze") {
    body = await clozeTemplateDocx();
    file = "挖空填词模板.docx";
    type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  } else {
    const t = TEMPLATES[kind];
    if (!t) return new Response("Not found", { status: 404 });
    body = makeWorkbook(t.sheet, t.rows, t.widths);
    file = t.file;
    type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file)}`,
    },
  });
}
