import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db, Role, User } from "./db";

const COOKIE = "sh_session";
const DAYS = 14;

/* 简单的登录防暴力破解：同一用户名 10 分钟内失败 5 次，锁定 10 分钟（内存计数，重启清零） */
const FAILS = new Map<string, { n: number; first: number }>();
const MAX_FAILS = 5;
const WINDOW = 10 * 60_000;

export function loginLocked(username: string) {
  const f = FAILS.get(username.trim().toLowerCase());
  return !!f && f.n >= MAX_FAILS && Date.now() - f.first < WINDOW;
}

export function verifyLogin(username: string, password: string): User | null {
  const key = username.trim().toLowerCase();
  if (loginLocked(key)) return null;
  const row = db.prepare("SELECT * FROM users WHERE username = ? AND active = 1").get(username.trim()) as
    | (User & { password_hash: string })
    | undefined;
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    const f = FAILS.get(key);
    if (!f || Date.now() - f.first > WINDOW) FAILS.set(key, { n: 1, first: Date.now() });
    else f.n++;
    return null;
  }
  FAILS.delete(key);
  const { password_hash, ...user } = row;
  return user;
}

/** 改密码后让该用户的其它设备下线（保留当前会话） */
export async function destroyOtherSessions(userId: number) {
  const token = (await cookies()).get(COOKIE)?.value ?? "";
  db.prepare("DELETE FROM sessions WHERE user_id = ? AND token <> ?").run(userId, token);
}

export async function createSession(userId: number) {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + DAYS * 86400_000);
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(new Date().toISOString());
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)").run(token, userId, expires.toISOString());
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", expires });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  jar.delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.id, u.username, u.name, u.role, u.org_id, u.active FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ? AND u.active = 1`
    )
    .get(token, new Date().toISOString()) as User | undefined;
  return row ?? null;
}

/** 页面/Action 守卫：未登录跳转登录页，角色不符跳转到自己的首页 */
export async function requireRole(...roles: Role[]): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (roles.length && !roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}

export function homeFor(role: Role) {
  return role === "admin" ? "/admin" : role === "teacher" ? "/teacher" : "/student";
}

export function hashPassword(pw: string) {
  return bcrypt.hashSync(pw, 10);
}
