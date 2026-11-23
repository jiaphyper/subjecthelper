import { db, User } from "./db";

/** 学生可以自由练习的学科（全部学生 / 本校 / 所在组别 被开放的） */
export function practiceSubjectIds(me: User): number[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT p.subject_id id FROM practice_grants p
       WHERE p.scope='all'
          OR (p.scope='org' AND p.org_id = ?)
          OR (p.scope='group' AND p.group_id IN (SELECT group_id FROM group_members WHERE student_id = ?))`
    )
    .all(me.org_id ?? -1, me.id) as { id: number }[];
  return rows.map((r) => r.id);
}

/** 教师负责的学科 id（admin 在账号管理里设置） */
export function teacherSubjectIds(teacherId: number): number[] {
  return (db.prepare("SELECT subject_id FROM teacher_subjects WHERE teacher_id=?").all(teacherId) as { subject_id: number }[]).map((r) => r.subject_id);
}

export const PRACTICE_LIMITS = { mcq: 50, match: 40 };
export const PRACTICE_ATTEMPTS = 99;
