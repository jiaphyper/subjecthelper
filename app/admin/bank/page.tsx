import { db } from "@/lib/db";
import { SP } from "@/lib/util";
import Flash from "@/components/Flash";
import UploadForm from "@/components/UploadForm";
import ConfirmButton from "@/components/ConfirmButton";
import CheckAll from "@/components/CheckAll";
import { deleteItems, addMcq, addVocab } from "./actions";
import { getT } from "@/lib/i18n-server";

const TABS = [["mcq", "选择题"], ["vocab", "词汇（连线题）"], ["cloze", "挖空填词"]] as const;
const L = "ABCDEFGHIJ";

export default async function BankPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const t = await getT();
  const subjects = db.prepare("SELECT id, name FROM subjects ORDER BY name").all() as { id: number; name: string }[];
  if (!subjects.length)
    return (<><h1>{t("题库")}</h1><div className="card">{t("请先在「学科」中添加学科。")} <a href="/admin/subjects">{t("学科")} →</a></div></>);
  const subject = subjects.find((s) => String(s.id) === sp.subject) ?? subjects[0];
  const tab = (TABS.find(([k]) => k === sp.tab)?.[0] ?? "mcq") as "mcq" | "vocab" | "cloze";
  const tag = sp.tag ?? "";
  const qs = new URLSearchParams(Object.entries({ subject: String(subject.id), tab, tag }).filter(([, v]) => v)).toString();
  const link = (o: Record<string, string>) => "/admin/bank?" + new URLSearchParams({ subject: String(subject.id), tab, ...o }).toString();

  const table = { mcq: "mcq_questions", vocab: "vocab", cloze: "cloze_sets" }[tab];
  const tags = db.prepare(`SELECT tag, COUNT(*) n FROM ${table} WHERE subject_id=? GROUP BY tag ORDER BY tag`).all(subject.id) as { tag: string | null; n: number }[];
  const tagWhere = tag === "__none" ? "AND tag IS NULL" : tag ? "AND tag = ?" : "";
  const tagArgs = tag && tag !== "__none" ? [tag] : [];
  let items: any[] = [];
  if (tab === "cloze")
    items = db.prepare(`SELECT s.*, (SELECT COUNT(*) FROM cloze_items i WHERE i.set_id=s.id) n FROM cloze_sets s WHERE subject_id=? ${tagWhere} ORDER BY id DESC`).all(subject.id, ...tagArgs);
  else items = db.prepare(`SELECT * FROM ${table} WHERE subject_id=? ${tagWhere} ORDER BY id DESC LIMIT 1000`).all(subject.id, ...tagArgs);

  return (
    <>
      <h1>{t("题库")}</h1>
      <Flash ok={sp.ok} err={sp.err} />
      <div className="row" style={{ marginBottom: 12 }}>
        <span className="muted small">{t("学科：")}</span>
        {subjects.map((s) => (
          <a key={s.id} href={`/admin/bank?subject=${s.id}&tab=${tab}`} className={"btn btn-sm " + (s.id === subject.id ? "" : "btn-ghost")}>{s.name}</a>
        ))}
      </div>
      <div className="tabs">
        {TABS.map(([k, label]) => (
          <a key={k} href={`/admin/bank?subject=${subject.id}&tab=${k}`} className={k === tab ? "active" : ""}>{t(label)}</a>
        ))}
      </div>

      <div className="grid2">
        <div className="card">
          <h2>{tab === "cloze" ? t("上传 Word 文档") : t("上传 Excel")}</h2>
          {tab === "mcq" && <p className="small muted">{t("表头：题干 | A | B | C | D | (E | F) | 答案 | 解析 | 标签。答案填字母。")}</p>}
          {tab === "vocab" && <p className="small muted">{t("表头：英文 | 中文 | 英文释义 | 标签。中文用于「英-中」连线，英文释义用于「英-英释义」连线，可只填其一。只填了中文的词不会出现在「英-英释义」连线里。")}</p>}
          {tab === "cloze" && <p className="small muted">{t("Word 中放一个两列表格：第一列是句子，需要填空的词加粗；第二列是多出来的干扰词。一个文档 = 一套题。")}</p>}
          <p><a href={`/api/templates/${tab}`}>{t("下载模板")}</a></p>
          <UploadForm endpoint={`/api/admin/import/${tab}`} accept={tab === "cloze" ? ".docx" : ".xlsx,.xls,.csv"}>
            <input type="hidden" name="subject_id" value={subject.id} />
            <div className="row field">
              {tab === "cloze" && <div style={{ flex: 1 }}><label>{t("套题名称（默认用文件名）")}</label><input type="text" name="title" /></div>}
              <div style={{ flex: 1 }}><label>{t("默认标签 / 单元（表格未填时使用）")}</label><input type="text" name="tag" placeholder={t("如 Unit 1")} /></div>
            </div>
          </UploadForm>
        </div>
        <div className="card">
          {tab === "mcq" && (
            <form action={addMcq}>
              <h2>{t("手动添加一题")}</h2>
              <input type="hidden" name="_qs" value={qs} /><input type="hidden" name="subject_id" value={subject.id} />
              <div className="field"><textarea name="stem" placeholder={t("题干")} rows={2} /></div>
              <div className="grid2" style={{ gap: 8 }}>
                {"ABCD".split("").map((x) => <input key={x} type="text" name={"opt" + x} placeholder={t(`选项 ${x}`)} />)}
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <select name="answer" style={{ width: 110 }}>{"ABCD".split("").map((x, i) => <option key={x} value={i}>{t(`答案 ${x}`)}</option>)}</select>
                <input type="text" name="tag" placeholder={t("标签")} style={{ width: 110 }} defaultValue={tag !== "__none" ? tag : ""} />
                <input type="text" name="explanation" placeholder={t("解析（可选）")} style={{ flex: 1, width: "auto" }} />
                <button>{t("添加")}</button>
              </div>
            </form>
          )}
          {tab === "vocab" && (
            <form action={addVocab}>
              <h2>{t("手动添加词汇")}</h2>
              <input type="hidden" name="_qs" value={qs} /><input type="hidden" name="subject_id" value={subject.id} />
              <div className="grid2" style={{ gap: 8 }}>
                <input type="text" name="word" placeholder={t("英文")} /><input type="text" name="chinese" placeholder={t("中文")} />
              </div>
              <div className="field" style={{ marginTop: 8 }}><input type="text" name="definition" placeholder={t("英文释义")} /></div>
              <div className="row"><input type="text" name="tag" placeholder={t("标签")} style={{ width: 140 }} defaultValue={tag !== "__none" ? tag : ""} /><button>{t("添加")}</button></div>
            </form>
          )}
          {tab === "cloze" && (
            <>
              <h2>{t("说明")}</h2>
              <p className="small">{t("学生端会把本套题中所有加粗词 + 第二列干扰词打乱，作为 word bank 卡片，学生拖拽卡片到空格中。")}</p>
              <p className="small">{t("教师布置任务时可以选择某一套题，并设置抽取的句子数量。")}</p>
            </>
          )}
        </div>
      </div>

      <div className="row" style={{ margin: "8px 0 12px" }}>
        <span className="muted small">{t("标签：")}</span>
        <a href={link({})} className={"btn btn-sm " + (tag ? "btn-ghost" : "")}>{t("全部")}</a>
        {tags.map((x) => {
          const v = x.tag ?? "__none";
          return <a key={v} href={link({ tag: v })} className={"btn btn-sm " + (tag === v ? "" : "btn-ghost")}>{x.tag ?? t("(无标签)")} · {x.n}</a>;
        })}
      </div>

      <form action={deleteItems}>
        <input type="hidden" name="_qs" value={qs} /><input type="hidden" name="kind" value={tab} />
        <div className="row" style={{ marginBottom: 8 }}>
          <span className="muted small">{t(`共 ${items.length} 项`)}</span>
          <CheckAll name="id" />
          <span className="right"><ConfirmButton message={t("删除勾选的项目？")}>{t("删除所选")}</ConfirmButton></span>
        </div>
        <div className="table-wrap">
          <table>
            {tab === "mcq" && (
              <>
                <thead><tr><th style={{ width: 36 }}></th><th>{t("题干")}</th><th>{t("选项")}</th><th>{t("标签")}</th></tr></thead>
                <tbody>
                  {items.map((q) => (
                    <tr key={q.id}>
                      <td><input type="checkbox" name="id" value={q.id} /></td>
                      <td>{q.stem}{q.explanation && <div className="small muted">{t("解析：")}{q.explanation}</div>}</td>
                      <td className="small">
                        {JSON.parse(q.options_json).map((o: string, i: number) => (
                          <div key={i} style={i === q.answer_index ? { color: "var(--ok)", fontWeight: 600 } : {}}>{L[i]}. {o}{i === q.answer_index ? " ✓" : ""}</div>
                        ))}
                      </td>
                      <td>{q.tag && <span className="badge gray">{q.tag}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
            {tab === "vocab" && (
              <>
                <thead><tr><th style={{ width: 36 }}></th><th>{t("英文")}</th><th>{t("中文")}</th><th>{t("英文释义")}</th><th>{t("标签")}</th></tr></thead>
                <tbody>
                  {items.map((v) => (
                    <tr key={v.id}>
                      <td><input type="checkbox" name="id" value={v.id} /></td>
                      <td><b>{v.word}</b></td><td>{v.chinese || <span className="muted">—</span>}</td>
                      <td className="small">{v.definition || <span className="muted">—</span>}</td>
                      <td>{v.tag && <span className="badge gray">{v.tag}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
            {tab === "cloze" && (
              <>
                <thead><tr><th style={{ width: 36 }}></th><th>{t("套题")}</th><th>{t("句子数")}</th><th>{t("标签")}</th><th>{t("上传时间")}</th></tr></thead>
                <tbody>
                  {items.map((s) => (
                    <tr key={s.id}>
                      <td><input type="checkbox" name="id" value={s.id} /></td>
                      <td><a href={`/admin/bank/cloze/${s.id}`}><b>{s.title}</b></a></td>
                      <td>{s.n}</td><td>{s.tag && <span className="badge gray">{s.tag}</span>}</td>
                      <td className="small muted">{s.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
            {!items.length && <tbody><tr><td colSpan={5} className="muted">{t("暂无内容")}</td></tr></tbody>}
          </table>
        </div>
      </form>
    </>
  );
}
