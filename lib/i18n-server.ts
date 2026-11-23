import { cookies } from "next/headers";
import { Lang, LANG_COOKIE, makeT } from "./i18n";

export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  return v === "en" ? "en" : "zh";
}

export async function getT() {
  return makeT(await getLang());
}
