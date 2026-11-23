import { getT } from "@/lib/i18n-server";

/** 提示条：服务端用中文写的提示在这里统一翻译 */
export default async function Flash({ ok, err }: { ok?: string; err?: string }) {
  const t = await getT();
  return (
    <>
      {ok && <div className="flash ok">{t(ok)}</div>}
      {err && <div className="flash bad">{t(err)}</div>}
    </>
  );
}
