import { db } from "./db";

export interface SubjectOption {
  id: number;
  name: string;
  mcqTags: { tag: string; n: number }[];
  vocabTags: { tag: string; cn: number; def: number; any: number }[];
  clozeSets: { id: number; title: string; tag: string | null; n: number }[];
}

/** 组卷表单需要的学科/标签/题量信息 */
export function loadSubjectOptions(ids?: number[]): SubjectOption[] {
  let subjects = db.prepare("SELECT id, name FROM subjects ORDER BY name").all() as { id: number; name: string }[];
  if (ids) subjects = subjects.filter((s) => ids.includes(s.id));
  return subjects.map((s) => ({
    ...s,
    mcqTags: db.prepare("SELECT COALESCE(tag,'') tag, COUNT(*) n FROM mcq_questions WHERE subject_id=? GROUP BY tag ORDER BY tag").all(s.id) as any,
    vocabTags: db
      .prepare(
        `SELECT COALESCE(tag,'') tag,
           SUM(COALESCE(TRIM(chinese),'')<>'') cn,
           SUM(COALESCE(TRIM(definition),'')<>'') def,
           SUM(COALESCE(TRIM(chinese),'')<>'' OR COALESCE(TRIM(definition),'')<>'') "any"
         FROM vocab WHERE subject_id=? GROUP BY tag ORDER BY tag`
      )
      .all(s.id) as any,
    clozeSets: db.prepare("SELECT s.id, s.title, s.tag, (SELECT COUNT(*) FROM cloze_items i WHERE i.set_id=s.id) n FROM cloze_sets s WHERE subject_id=? ORDER BY s.id DESC").all(s.id) as any,
  }));
}
