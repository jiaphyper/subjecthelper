import { destroySession } from "@/lib/auth";

/**
 * 退出登录。用相对地址跳转：浏览器会沿用当前访问的 IP / 域名。
 * （不能用 new URL("/login", req.url)：服务以 -H 0.0.0.0 启动时 req.url 的主机是 0.0.0.0）
 */
export async function GET() {
  await destroySession();
  return new Response(null, { status: 303, headers: { Location: "/login" } });
}
