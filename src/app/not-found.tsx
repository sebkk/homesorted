import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/ui/Logo";

export async function generateMetadata() {
  const t = await getTranslations("errorPages");
  return { title: t("notFoundTitle") };
}

export default async function NotFound() {
  const t = await getTranslations("errorPages");
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 px-7 py-8 text-center">
      <Logo size={44} />
      <div className="font-mono text-[13px] font-semibold text-ink-faint tracking-wider">404</div>
      <h1 className="text-xl font-bold tracking-tight">{t("notFoundTitle")}</h1>
      <p className="text-[13px] text-ink-muted leading-relaxed max-w-[280px]">{t("notFoundBody")}</p>
      <Link href="/launcher" className="mt-2 font-bold text-[14.5px] text-accent-ink bg-accent rounded-md py-3 px-6">
        {t("backHome")}
      </Link>
    </div>
  );
}
