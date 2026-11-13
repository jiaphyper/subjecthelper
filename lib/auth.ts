import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db, Role, User } from "./db";

const COOKIE = "sh_session";
const DAYS = 14;

export function verifyLogin(username: string, password: string): User | null {
  const row = db.prepare("SELECT * FROM users WHERE username = ? AND active = 1").get(username.trim()) as
    | (User & { password_hash: string })
    | undefined;
  if (!row || !bcrypt.compareSync(password, row.password_hash)) return null;
  const { password_hash, ...user } = row;
  return user;
}

export async function createSession(userId: number) {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + DAYS * 86400_000);
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
