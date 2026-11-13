import { redirect } from "next/navigation";

export function str(fd: FormData, key: string) {
  return String(fd.get(key) ?? "").trim();
}
export function int(fd: FormData, key: string): number | null {
  const v = parseInt(String(fd.get(key) ?? ""), 10);
  return Number.isFinite(v) ? v : null;
}
export function ints(fd: FormData, key: string): number[] {
  return fd.getAll(key).map((v) => parseInt(String(v), 10)).filter(Number.isFinite);
}
/** 带提示信息跳回 */
export function back(path: string, msg: { ok?: string; err?: string }): never {
  const u = new URL(path, "http://x");
  if (msg.ok) u.searchParams.set("ok", msg.ok);
  if (msg.err) u.searchParams.set("err", msg.err);
  redirect(u.pathname + u.search);
}
export type SP = Promise<Record<string, string | undefined>>;

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
