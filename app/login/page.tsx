import { redirect } from "next/navigation";
import { verifyLogin, createSession, homeFor, currentUser } from "@/lib/auth";

async function login(formData: FormData) {
  "use server";
  const user = verifyLogin(String(formData.get("username") || ""), String(formData.get("password") || ""));
  if (!user) redirect("/login?error=1");
  await createSession(user.id);
  redirect(homeFor(user.role));
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const me = await currentUser();
  if (me) redirect(homeFor(me.role));
  const sp = await searchParams;
  return (
    <div className="login-wrap">
      <form action={login} className="card login">
        <h1>SubjectHelper</h1>
        <p className="muted small" style={{ marginTop: -8 }}>作业与练习平台</p>
        {sp.error && <div className="flash bad">用户名或密码错误</div>}
        <div className="field">
          <label>用户名</label>
          <input type="text" name="username" required autoFocus />
        </div>
        <div className="field">
          <label>密码</label>
          <input type="password" name="password" required />
        </div>
        <button type="submit" style={{ width: "100%", justifyContent: "center" }}>登录</button>
      </form>
    </div>
  );
}
