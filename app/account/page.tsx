import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { requireRole, homeFor, hashPassword, destroyOtherSessions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n-server";
import Flash from "@/components/Flash";

async function changePassword(fd: FormData) {
  "use server";
  const me = await requireRole();
  const oldPw = String(fd.get("old") || "");
  const newPw = String(fd.get("new") || "");
  const row = db.prepare("SELECT password_hash FROM users WHERE id=?").get(me.id) as { password_hash: string };
  if (!bcrypt.compareSync(oldPw, row.password_hash)) redirect("/account?err=" + encodeURIComponent("原密码不正确"));
  if (newPw.length < 6) redirect("/account?err=" + encodeURIComponent("新密码至少 6 位"));
  if (newPw === oldPw) redirect("/account?err=" + encodeURIComponent("新密码不能和原密码相同"));
  db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(hashPassword(newPw), me.id);
  await destroyOtherSessions(me.id);
  redirect("/account?ok=" + encodeURIComponent("密码已修改，其它设备上的登录已退出"));
}

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const me = await requireRole();
  const t = await getT();
  const sp = await searchParams;
  return (
    <div className="login-wrap">
      <form action={changePassword} className="card login">
        <h1>{t("修改密码")}</h1>
        <Flash ok={sp.ok} err={sp.err} />
        <div className="field"><label>{t("原密码")}</label><input type="password" name="old" required autoComplete="current-password" /></div>
        <div className="field"><label>{t("新密码（至少 6 位）")}</label><input type="password" name="new" required minLength={6} autoComplete="new-password" /></div>
        <div className="row">
          <button type="submit">{t("保存")}</button>
          <a href={homeFor(me.role)} className="btn btn-ghost">{t("返回")}</a>
        </div>
      </form>
    </div>
  );
}
