"use server";
import { db } from "./db";
import { currentUser } from "./auth";

/** 看完 / 跳过新手指引后记一笔，换设备登录也不会再自动弹出 */
export async function markOnboarded() {
  const me = await currentUser();
  if (me) db.prepare("UPDATE users SET onboarded=1 WHERE id=?").run(me.id);
}
