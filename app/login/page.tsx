import { redirect } from "next/navigation";
import { verifyLogin, createSession, homeFor, currentUser, loginLocked } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { LangSwitch } from "@/components/I18nProvider";

async function login(formData: FormData) {
  "use server";
  const username = String(formData.get("username") || "");
  if (loginLocked(username)) redirect("/login?error=locked");
  const user = verifyLogin(username, String(formData.get("password") || ""));
  if (!user) redirect(loginLocked(username) ? "/login?error=locked" : "/login?error=1");
  await createSession(user.id);
  redirect(homeFor(user.role));
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; changed?: string }> }) {
  const me = await currentUser();
  if (me) redirect(homeFor(me.role));
  const t = await getT();
  const sp = await searchParams;
  return (
    <div className="login-wrap">
      <form action={login} className="card login">
        <div className="row" style={{ alignItems: "flex-start" }}>
          <div>
            <h1 style={{ marginBottom: 4 }}>SubjectHelper</h1>
            <p className="muted small" style={{ margin: "0 0 16px" }}>{t("作业与练习平台")}</p>
          </div>
          <LangSwitch className="right" />
        </div>
        {sp.changed && !sp.error && <div className="flash ok">{t("密码已修改，请用新密码重新登录")}</div>}
        {sp.error && <div className="flash bad">{sp.error === "locked" ? t("登录失败次数过多，请 10 分钟后再试") : t("用户名或密码错误")}</div>}
        <div className="field">
          <label>{t("用户名")}</label>
          <input type="text" name="username" required autoFocus autoComplete="username" />
        </div>
        <div className="field">
          <label>{t("密码")}</label>
          <input type="password" name="password" required autoComplete="current-password" />
        </div>
        <button type="submit" style={{ width: "100%", justifyContent: "center" }}>{t("登录")}</button>
      </form>
    </div>
  );
}
