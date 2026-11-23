import { getT } from "@/lib/i18n-server";
import Countdown from "./Countdown";

/** 改密码成功页：已退出登录，倒计时后自动去登录页 */
export default async function PasswordChanged() {
  const t = await getT();
  return (
    <div className="login-wrap">
      <div className="card login done-card">
        <div className="done-icon" aria-hidden>✓</div>
        <h1>{t("密码已修改")}</h1>
        <p className="muted">{t("为了安全，所有设备上的登录都已退出。请用新密码重新登录。")}</p>
        <Countdown to="/login?changed=1" seconds={3} />
      </div>
    </div>
  );
}
