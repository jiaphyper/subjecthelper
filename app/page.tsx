import { currentUser, homeFor } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { LangSwitch } from "@/components/I18nProvider";

/** 产品首页：介绍 + 登录入口。已登录用户显示「进入我的主页」 */
export default async function Landing() {
  const t = await getT();
  const me = await currentUser();
  const cta = me ? { href: homeFor(me.role), label: t("进入我的主页") } : { href: "/login", label: t("登录") };

  const types = [
    {
      title: t("选择题"),
      desc: t("每次作答题目不变，题目和选项顺序重新打乱，第一次校验的结果计分。"),
      demo: (
        <div className="lp-demo-mcq">
          <div className="lp-demo-q">{t("力的国际单位是？")}</div>
          {["joule", "newton", "watt"].map((o, i) => (
            <div key={o} className={"lp-demo-opt" + (i === 1 ? " ok" : "")}><span>{"ABC"[i]}</span>{o}</div>
          ))}
        </div>
      ),
    },
    {
      title: t("连线题"),
      desc: t("英文—中文、英文—英文释义可同时出题，左右两边中英混排，每次随机。"),
      demo: (
        <div className="lp-demo-match">
          {[["velocity", "速度"], ["频率", "frequency"], ["orbit", "轨道"]].map(([a, b], i) => (
            <div key={i} className="lp-demo-row">
              <span className="lp-chip">{a}</span><i className={"lp-line" + (i === 1 ? " slant" : "")} /><span className="lp-chip">{b}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      title: t("挖空填词"),
      desc: t("从 Word bank 拖卡片到空格，带干扰词。Word 文档一键导入成套题。"),
      demo: (
        <div className="lp-demo-cloze">
          <div className="lp-bank"><span>current</span><span>battery</span><span>wave</span></div>
          <p>Electric <b className="lp-blank">current</b> is the rate of flow of <b className="lp-blank empty" />.</p>
        </div>
      ),
    },
  ];

  const roles = [
    { icon: "🏫", title: t("管理员"), items: [t("学校、学科、账号与批量导入"), t("题库：Excel / Word 导入"), t("设置教师学科，开放自由练习")] },
    { icon: "👩‍🏫", title: t("教师"), items: [t("创建组别，按组布置任务"), t("随机抽题，发布时冻结"), t("查看每个学生每次的成绩，导出 Excel")] },
    { icon: "🎒", title: t("学生"), items: [t("逐题校验，即时知道对错"), t("最多 3 次机会，取最高分"), t("自由组卷刷题，不计入成绩")] },
  ];

  const features = [
    [t("进度自动保存"), t("刷新、断网、切到后台都不丢")],
    [t("手机也好用"), t("拖拽连线、拖卡片都支持触屏")],
    [t("中 / EN 界面"), t("一键切换，不丢正在填写的内容")],
    [t("数据在自己服务器"), t("SQLite 单文件，复制即备份")],
  ];

  return (
    <div className="lp">
      <header className="lp-nav">
        <a href="/" className="lp-logo"><span className="lp-mark">S</span>SubjectHelper</a>
        <span className="grow" />
        <LangSwitch />
        <a href={cta.href} className="btn">{cta.label}</a>
      </header>

      <section className="lp-hero">
        <div className="lp-hero-text">
          <span className="lp-eyebrow">{t("作业与练习平台")}</span>
          <h1>{t("让每一次练习，都知道自己错在哪")}</h1>
          <p>{t("选择题、连线题、挖空填词，教师按组布置，学生逐题校验、即时反馈。题库一次导入，反复使用。")}</p>
          <div className="row lp-hero-cta">
            <a href={cta.href} className="btn lp-btn-lg">{me ? cta.label : t("登录开始使用")} →</a>
            <a href="#features" className="btn btn-ghost lp-btn-lg">{t("了解功能")}</a>
          </div>
        </div>
        <div className="lp-hero-art" aria-hidden>
          <div className="lp-card lp-card-back">
            <div className="lp-dots">{[1, 2, 3, 4, 5].map((n) => <i key={n} className={n < 3 ? "full" : n === 3 ? "part" : ""} />)}</div>
            <div className="lp-bar" /><div className="lp-bar short" />
          </div>
          <div className="lp-card lp-card-front">
            <div className="lp-card-head"><b>{t("连线题")}</b><span className="badge ok">{t("全部正确！")}</span></div>
            {[["evaporation", "蒸发"], ["振幅", "amplitude"], ["half-life", "半衰期"], ["效率", "efficiency"]].map(([a, b], i) => (
              <div key={i} className="lp-demo-row"><span className="lp-chip ok">{a}</span><i className="lp-line ok" /><span className="lp-chip ok">{b}</span></div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="lp-section">
        <h2>{t("三种题型")}</h2>
        <div className="lp-grid3">
          {types.map((x) => (
            <div key={x.title} className="lp-type">
              <div className="lp-type-demo">{x.demo}</div>
              <h3>{x.title}</h3>
              <p>{x.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section">
        <h2>{t("三种角色，各司其职")}</h2>
        <div className="lp-grid3">
          {roles.map((r) => (
            <div key={r.title} className="lp-role">
              <div className="lp-role-icon">{r.icon}</div>
              <h3>{r.title}</h3>
              <ul>{r.items.map((i) => <li key={i}>{i}</li>)}</ul>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-features">
          {features.map(([a, b]) => (
            <div key={a}><b>{a}</b><span>{b}</span></div>
          ))}
        </div>
      </section>

      <section className="lp-final">
        <h2>{me ? t("欢迎回来") : t("准备好了吗？")}</h2>
        <p>{me ? t(`你已登录为 ${me.name}`) : t("账号由学校管理员统一创建，请使用老师或管理员给你的账号登录。")}</p>
        <a href={cta.href} className="btn lp-btn-lg lp-btn-light">{cta.label} →</a>
      </section>

      <footer className="lp-foot">© {new Date().getFullYear()} SubjectHelper</footer>
    </div>
  );
}
