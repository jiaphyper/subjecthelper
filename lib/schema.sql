PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS orgs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','teacher','student')),
  org_id INTEGER REFERENCES orgs(id) ON DELETE SET NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

-- 教师-学生绑定（多对多）
CREATE TABLE IF NOT EXISTS teacher_students (
  teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (teacher_id, student_id)
);

-- 组别：属于某个学校，可由教师创建
CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, student_id)
);

CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 选择题
CREATE TABLE IF NOT EXISTS mcq_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  stem TEXT NOT NULL,
  options_json TEXT NOT NULL,
  answer_index INTEGER NOT NULL,
  explanation TEXT,
  tag TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 词汇（用于连线：英-中 / 英-英释义）
CREATE TABLE IF NOT EXISTS vocab (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  chinese TEXT,
  definition TEXT,
  example TEXT,      -- 应用 / 例句：第一行英文，其余行中文翻译
  tag TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 挖空填词：一个 Word 文档 = 一套
CREATE TABLE IF NOT EXISTS cloze_sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  tag TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cloze_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  set_id INTEGER NOT NULL REFERENCES cloze_sets(id) ON DELETE CASCADE,
  segments_json TEXT NOT NULL,   -- [{"t":"文本"},{"b":"答案"}]
  distractors_json TEXT NOT NULL DEFAULT '[]',
  sort INTEGER NOT NULL DEFAULT 0
);

-- 任务
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  subject_id INTEGER NOT NULL REFERENCES subjects(id),
  teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id INTEGER REFERENCES orgs(id),
  config_json TEXT NOT NULL,     -- 教师选择的题型/数量
  content_json TEXT NOT NULL,    -- 发布时冻结的题目 id 列表
  max_attempts INTEGER NOT NULL DEFAULT 3,
  due_at TEXT,
  kind TEXT NOT NULL DEFAULT 'task',   -- task = 教师布置；practice = 学生自由练习（teacher_id 存学生本人）
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS task_groups (
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, group_id)
);

-- 发布时的接收学生快照
CREATE TABLE IF NOT EXISTS task_students (
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, student_id)
);

CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attempt_no INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','submitted')),
  layout_json TEXT NOT NULL DEFAULT '{}',   -- 本次作答的题目排列（连线分组、卡片顺序）
  checked_json TEXT NOT NULL DEFAULT '{}',  -- 已校验（已计分）的题目单元及首次得分
  answers_json TEXT NOT NULL DEFAULT '{}',  -- 每个单元「第一次校验」时的答案，用于计分
  result_json TEXT NOT NULL DEFAULT '{}',
  draft_json TEXT NOT NULL DEFAULT '{}',    -- 作答草稿（自动保存，刷新/中断后恢复）
  score INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  submitted_at TEXT,
  UNIQUE (task_id, student_id, attempt_no)
);

-- 教师负责的学科（admin 设置）：教师只能对自己的学科开放自由练习
CREATE TABLE IF NOT EXISTS teacher_subjects (
  teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  PRIMARY KEY (teacher_id, subject_id)
);

-- 自由练习开放范围：all=所有学生，org=某学校，group=某组别
CREATE TABLE IF NOT EXISTS practice_grants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('all','org','group')),
  org_id INTEGER REFERENCES orgs(id) ON DELETE CASCADE,
  group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
  granted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_org ON users(org_id, role);
CREATE INDEX IF NOT EXISTS idx_mcq_subject ON mcq_questions(subject_id, tag);
CREATE INDEX IF NOT EXISTS idx_vocab_subject ON vocab(subject_id, tag);
CREATE INDEX IF NOT EXISTS idx_attempts_task ON attempts(task_id, student_id);
