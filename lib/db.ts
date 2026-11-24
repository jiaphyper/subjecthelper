import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "app.db");

function init(): Database.Database {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  const schema = fs.readFileSync(path.join(process.cwd(), "lib", "schema.sql"), "utf8");
  migrate(db);
  db.exec(schema);
  addColumns(db);
  // 首次运行：创建默认管理员
  const hasAdmin = db.prepare("SELECT 1 FROM users WHERE role='admin' LIMIT 1").get();
  if (!hasAdmin) {
    db.prepare("INSERT INTO users (username, password_hash, name, role) VALUES (?,?,?, 'admin')")
      .run("admin", bcrypt.hashSync("admin123", 10), "管理员");
  }
  return db;
}

/** 旧版数据库升级 */
function migrate(db: Database.Database) {
  const cols = db.prepare("PRAGMA table_info(attempts)").all() as { name: string }[];
  // v0.1 的 attempts 表没有 status 列（整卷提交模式），升级为逐题校验模式
  if (cols.length && !cols.some((c) => c.name === "status")) db.exec("DROP TABLE attempts");
}

/** 给旧库补列（CREATE TABLE IF NOT EXISTS 不会改已有表） */
function addColumns(db: Database.Database) {
  const has = (table: string, col: string) =>
    (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).some((c) => c.name === col);
  if (!has("tasks", "kind")) db.exec("ALTER TABLE tasks ADD COLUMN kind TEXT NOT NULL DEFAULT 'task'");
  if (!has("vocab", "example")) db.exec("ALTER TABLE vocab ADD COLUMN example TEXT");
  if (!has("attempts", "draft_json")) db.exec("ALTER TABLE attempts ADD COLUMN draft_json TEXT NOT NULL DEFAULT '{}'");
  db.exec("CREATE INDEX IF NOT EXISTS idx_tasks_kind ON tasks(kind, teacher_id)");
  db.exec("DELETE FROM sessions WHERE expires_at < strftime('%Y-%m-%dT%H:%M:%fZ','now')");
}

const g = globalThis as unknown as { __db?: Database.Database };
export const db: Database.Database = g.__db ?? (g.__db = init());

export type Role = "admin" | "teacher" | "student";
export interface User {
  id: number;
  username: string;
  name: string;
  role: Role;
  org_id: number | null;
  active: number;
}
