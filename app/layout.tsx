import "./globals.css";
import type { Metadata } from "next";
import { getLang } from "@/lib/i18n-server";
import { translate } from "@/lib/i18n";
import { I18nProvider } from "@/components/I18nProvider";

export async function generateMetadata(): Promise<Metadata> {
  return { title: translate(await getLang(), "SubjectHelper 作业平台") };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang === "en" ? "en" : "zh-CN"}>
      <body>
        <I18nProvider lang={lang}>{children}</I18nProvider>
      </body>
    </html>
  );
}
