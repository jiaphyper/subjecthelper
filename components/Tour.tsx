"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useT } from "./I18nProvider";
import { markOnboarded } from "@/lib/onboarding";

/**
 * 新手指引：页面变暗模糊，只露出高亮区域，配「下一步」。可以跨页面：
 * 每一步绑定一个页面（path），用户走到哪一页，指引就跟到那一页对应的步骤。
 */
export interface TourStep {
  path: RegExp;
  /** 高亮的元素（多个时取并集）；不填则居中显示 */
  target?: string[];
  title: string;
  body: string;
  /** 需要用户点击高亮区域（跳转页面）才能继续 */
  action?: "click" | "do";
  /** 不在这一页时，「继续指引」跳转的地址 */
  url: string;
  welcome?: boolean;
}

export const TEACHER_STEPS: TourStep[] = [
  { path: /^\/teacher/, welcome: true, url: "/teacher", title: "欢迎使用 SubjectHelper 👋", body: "开始布置作业只需要三步：创建组别 → 把学生加入组别 → 布置任务。跟着指引走一遍，大约 1 分钟。" },
  { path: /^\/teacher$/, target: ['.side a[href="/teacher/groups"]'], action: "click", url: "/teacher", title: "第 1 步：创建组别", body: "组别就是你的班级或学生小组，任务按组别发布。点击高亮的「组别」。" },
  { path: /^\/teacher\/groups$/, target: ['[data-tour="group-create"]', '[data-tour="group-list"]'], action: "do", url: "/teacher/groups", title: "创建一个组别", body: "输入组别名称（如 G10-A），点「创建组别」。已经有组别的话，直接点列表里的「编辑成员」。" },
  { path: /^\/teacher\/groups\/\d+$/, target: ['[data-tour="group-members"]'], url: "/teacher/groups", title: "第 2 步：把学生加入组别", body: "列表里是本校的学生。勾选要加入这个组别的学生（人多时可以用上面的搜索框），然后点「保存」。以后随时可以回来增减。" },
  { path: /^\/teacher\/groups\/\d+$/, target: ['.side a[href="/teacher/students"]'], url: "/teacher/groups", title: "（可选）我的学生", body: "在「我的学生」里绑定你任教的学生：编辑组别时可以只看自己的学生，查看学生情况也更方便。" },
  { path: /^\/teacher\/groups\/\d+$/, target: ['.side a[href="/teacher/tasks/new"]'], action: "click", url: "/teacher/groups", title: "第 3 步：布置任务", body: "组别里有学生后，就可以布置任务了。点击高亮的「布置任务」。" },
  { path: /^\/teacher\/tasks\/new$/, target: ['[data-tour="task-title"]'], url: "/teacher/tasks/new", title: "任务名称", body: "填写任务名称。可以设置每个学生的尝试次数（取最高分）和截止时间。" },
  { path: /^\/teacher\/tasks\/new$/, target: ['[data-tour="task-content"]'], url: "/teacher/tasks/new", title: "选择学科和题型", body: "选择题、连线题、挖空填词可以同时勾选，并设置数量。题目从题库随机抽取，发布后就固定不变。" },
  { path: /^\/teacher\/tasks\/new$/, target: ['[data-tour="task-groups"]'], url: "/teacher/tasks/new", title: "选择组别", body: "勾选要发布的组别，下方会显示预计接收的人数。" },
  { path: /^\/teacher\/tasks\/new$/, target: ['[data-tour="task-publish"]'], url: "/teacher/tasks/new", title: "发布任务", body: "必填项都完成后按钮会变亮，点「发布任务」即可，学生登录后就能看到。之后在「我的任务」里查看每个学生的成绩。" },
];

type Rect = { top: number; left: number; width: number; height: number };
const PAD = 8;
const EVT = "sh-tour-start";

/** 侧栏里的「新手指引」按钮：随时重新打开 */
export function TourLauncher() {
  const t = useT();
  return (
    <a href="#" onClick={(e) => { e.preventDefault(); window.dispatchEvent(new Event(EVT)); }}>{t("新手指引")}</a>
  );
}

export default function Tour({ steps, storageKey, onboarded }: { steps: TourStep[]; storageKey: string; onboarded: boolean }) {
  const t = useT();
  const path = usePathname();
  const router = useRouter();
  const [stage, setStageState] = useState<number | "done" | null>(null); // null = 还没读取
  const [rect, setRect] = useState<Rect | null>(null);
  const [vw, setVw] = useState(1200);
  const [vh, setVh] = useState(800);
  const scrolledFor = useRef<string>("");

  const setStage = useCallback((s: number | "done") => {
    setStageState(s);
    try { localStorage.setItem(storageKey, String(s)); } catch {}
  }, [storageKey]);

  // 读取进度；从没看过（onboarded=false）就从欢迎页开始
  useEffect(() => {
    let v: string | null = null;
    try { v = localStorage.getItem(storageKey); } catch {}
    if (v === "done") setStageState("done");
    else if (v !== null && !Number.isNaN(Number(v))) setStageState(Math.min(Number(v), steps.length - 1));
    else setStageState(onboarded ? "done" : 0);
    const start = () => setStage(0);
    window.addEventListener(EVT, start);
    return () => window.removeEventListener(EVT, start);
  }, [storageKey, onboarded, steps.length, setStage]);

  // 用户走到了后面某一步对应的页面 → 指引跟过去
  const active = typeof stage === "number" ? stage : -1;
  const onPage = active >= 0 && steps[active].path.test(path);
  useEffect(() => {
    if (active < 0 || onPage) return;
    const j = steps.findIndex((s, i) => i > active && s.path.test(path));
    if (j > 0) setStage(j);
  }, [active, onPage, path, steps, setStage]);

  const step = active >= 0 ? steps[active] : null;
  const finish = useCallback(() => {
    setStage("done");
    setRect(null);
    markOnboarded().catch(() => {});
  }, [setStage]);

  // 跟踪高亮元素的位置（滚动、缩放、内容变化）
  useEffect(() => {
    if (!step || !onPage || !step.target) { setRect(null); return; }
    const key = active + path;
    const measure = () => {
      setVw(window.innerWidth); setVh(window.innerHeight);
      const els = step.target!.map((s) => document.querySelector(s) as HTMLElement | null).filter(Boolean) as HTMLElement[];
      if (!els.length) { setRect(null); return; }
      if (scrolledFor.current !== key) {
        scrolledFor.current = key;
        els[0].scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
      }
      const rs = els.map((e) => e.getBoundingClientRect());
      const top = Math.min(...rs.map((r) => r.top)), left = Math.min(...rs.map((r) => r.left));
      const bottom = Math.max(...rs.map((r) => r.bottom)), right = Math.max(...rs.map((r) => r.right));
      setRect((old) => {
        const n = { top: top - PAD, left: left - PAD, width: right - left + PAD * 2, height: bottom - top + PAD * 2 };
        return old && Math.abs(old.top - n.top) < 0.5 && Math.abs(old.left - n.left) < 0.5 && Math.abs(old.width - n.width) < 0.5 && Math.abs(old.height - n.height) < 0.5 ? old : n;
      });
    };
    measure();
    const h = setInterval(measure, 200);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => { clearInterval(h); window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [step, onPage, active, path]);

  // Esc 退出
  useEffect(() => {
    if (!step || !onPage) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && finish();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [step, onPage, finish]);

  const total = steps.filter((s) => !s.welcome).length;
  const no = steps.slice(0, active + 1).filter((s) => !s.welcome).length;

  // 弹框位置：优先放在高亮区域右侧（侧栏），否则下方 / 上方；手机上固定在底部
  const pop = useMemo(() => {
    const W = 330;
    if (!rect || vw < 640) return null;
    // 高亮区域很高（如长列表）：弹框固定在右下角，不挡内容
    if (rect.height > vh * 0.6) return { left: vw - W - 20, top: vh - 250 };
    if (rect.width < vw * 0.35 && rect.left + rect.width + 16 + W < vw) return { left: rect.left + rect.width + 16, top: Math.max(12, Math.min(rect.top, vh - 260)) };
    const left = Math.max(12, Math.min(rect.left, vw - W - 12));
    if (rect.top + rect.height + 16 + 220 < vh) return { left, top: rect.top + rect.height + 16 };
    if (rect.top - 16 - 220 > 0) return { left, top: rect.top - 16 - 220 };
    return { left: vw - W - 20, top: Math.max(12, vh - 260) }; // 上下都放不下：放右下角，尽量不挡左侧的勾选框
  }, [rect, vw, vh]);

  if (stage === null || stage === "done" || !step) return null;

  // 不在当前步骤的页面：右下角显示「继续指引」
  if (!onPage) {
    return (
      <div className="tour-resume">
        <span>{t("新手指引")} · {t(step.title)}</span>
        <button className="btn-sm" onClick={() => router.push(step.url)}>{t("继续")}</button>
        <button className="btn-sm btn-ghost" onClick={finish}>{t("退出")}</button>
      </div>
    );
  }

  const prev = active > 0 && steps[active - 1].path.test(path) && !steps[active - 1].welcome ? active - 1 : null;
  const isLast = active === steps.length - 1;
  const clickTarget = () => {
    const el = step.target && (document.querySelector(step.target[0]) as HTMLElement | null);
    el?.click();
  };

  const shade = (style: React.CSSProperties, key: string) => <div key={key} className="tour-shade" style={style} />;
  const shades = rect
    ? [
        shade({ top: 0, left: 0, width: "100%", height: Math.max(0, rect.top) }, "t"),
        shade({ top: rect.top + rect.height, left: 0, width: "100%", bottom: 0 }, "b"),
        shade({ top: rect.top, left: 0, width: Math.max(0, rect.left), height: rect.height }, "l"),
        shade({ top: rect.top, left: rect.left + rect.width, right: 0, height: rect.height }, "r"),
      ]
    : [shade({ inset: 0 }, "all")];

  return (
    <div className="tour-root" role="dialog" aria-modal="true" aria-label={t("新手指引")}>
      {shades}
      {rect && <div className="tour-ring" style={rect} />}
      <div className={"tour-pop" + (step.welcome || !pop ? " center" : "")} style={pop && !step.welcome ? pop : undefined}>
        {step.welcome ? (
          <>
            <h3>{t(step.title)}</h3>
            <p>{t(step.body)}</p>
            <ol className="tour-steps">
              <li><b>{t("创建组别")}</b><span>{t("你的班级或学生小组")}</span></li>
              <li><b>{t("把学生加入组别")}</b><span>{t("从本校学生中勾选")}</span></li>
              <li><b>{t("布置任务")}</b><span>{t("选题型、数量和组别，一键发布")}</span></li>
            </ol>
            <div className="tour-actions">
              <button className="btn-ghost" onClick={finish}>{t("以后再说")}</button>
              <button onClick={() => setStage(1)}>{t("开始指引")} →</button>
            </div>
            <div className="small muted" style={{ marginTop: 10 }}>{t("之后可以随时点左侧的「新手指引」重新打开。")}</div>
          </>
        ) : (
          <>
            <div className="tour-count">{t(`第 ${no} / ${total} 步`)}</div>
            <h3>{t(step.title)}</h3>
            <p>{t(step.body)}</p>
            {!rect && step.target && <p className="small muted">{t("（这一页没有找到对应的位置，可以直接点「下一步」）")}</p>}
            <div className="tour-actions">
              <button className="tour-skip" onClick={finish}>{t("跳过指引")}</button>
              <span className="grow" />
              {prev !== null && <button className="btn-ghost btn-sm" onClick={() => setStage(prev)}>{t("上一步")}</button>}
              {step.action === "do" && rect ? (
                <span className="small tour-hint">{t("请在高亮区域操作")}</span>
              ) : step.action === "click" && rect ? (
                <button className="btn-sm" onClick={clickTarget}>{t("带我去")} →</button>
              ) : isLast ? (
                <button className="btn-sm" onClick={finish}>{t("完成")} ✓</button>
              ) : (
                <button className="btn-sm" onClick={() => setStage(active + 1)}>{t("下一步")} →</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
