// 导入 Physics 0625 演示题：npm run demo
// 可在网站运行时执行。重复运行会先清空「Physics 0625 (Demo)」学科下的题目再导入。
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";

const root = process.cwd();
const dataDir = process.env.DATA_DIR || path.join(root, "data");
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, "app.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");
db.exec(fs.readFileSync(path.join(root, "lib", "schema.sql"), "utf8"));
if (!db.prepare("SELECT 1 FROM users WHERE role='admin'").get())
  db.prepare("INSERT INTO users (username, password_hash, name, role) VALUES ('admin', ?, '管理员', 'admin')").run(bcrypt.hashSync("admin123", 10));

const d = JSON.parse(fs.readFileSync(path.join(root, "demo", "physics0625.json"), "utf8"));
const toSegments = (s) => s.split(/\*\*(.+?)\*\*/).map((p, i) => (i % 2 ? { b: p } : { t: p })).filter((x) => (x.t ?? x.b) !== "");

db.transaction(() => {
  let sub = db.prepare("SELECT id FROM subjects WHERE name=?").get(d.subject);
  if (!sub) sub = { id: Number(db.prepare("INSERT INTO subjects (name) VALUES (?)").run(d.subject).lastInsertRowid) };
  for (const t of ["mcq_questions", "vocab", "cloze_sets"]) db.prepare(`DELETE FROM ${t} WHERE subject_id=?`).run(sub.id);

  const mq = db.prepare("INSERT INTO mcq_questions (subject_id, stem, options_json, answer_index, explanation, tag) VALUES (?,?,?,?,?,?)");
  for (const [stem, opts, ans, exp, tag] of d.mcq) mq.run(sub.id, stem, JSON.stringify(opts), ans, exp || null, tag);

  const vq = db.prepare("INSERT INTO vocab (subject_id, word, chinese, definition, tag) VALUES (?,?,?,?,?)");
  for (const [w, zh, def, tag] of d.vocab) vq.run(sub.id, w, zh, def, tag);

  for (const cz of d.cloze) {
    const setId = db.prepare("INSERT INTO cloze_sets (subject_id, title, tag) VALUES (?,?,?)").run(sub.id, cz.title, cz.tag).lastInsertRowid;
    const iq = db.prepare("INSERT INTO cloze_items (set_id, segments_json, distractors_json, sort) VALUES (?,?,?,?)");
    cz.rows.forEach(([sent, extra], i) => iq.run(setId, JSON.stringify(toSegments(sent)), JSON.stringify(extra ? [extra] : []), i));
  }
})();

console.log(`✅ 已导入「${d.subject}」：选择题 ${d.mcq.length} 道，词汇 ${d.vocab.length} 个，填空 ${d.cloze.length} 套`);
console.log("   删除演示内容：管理员后台 → 学科 → 删除「Physics 0625 (Demo)」");
db.close();
