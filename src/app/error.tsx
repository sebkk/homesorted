"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/ui/Logo";

// Shown when a page throws while rendering. `reset` re-renders the segment,
// which is enough for passing problems like a dropped connection.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errorPages");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 px-7 py-8 text-center">
      <Logo size={44} />
      <h1 className="text-xl font-bold tracking-tight">{t("errorTitle")}</h1>
      <p className="text-[13px] text-ink-muted leading-relaxed max-w-[280px]">{t("errorBody")}</p>
      <div className="flex flex-col gap-2 w-full max-w-[280px] mt-2">
        <button type="button" onClick={reset} className="font-bold text-[14.5px] text-accent-ink bg-accent rounded-md py-3">
          {t("retry")}
        </button>
        <Link href="/launcher" className="font-semibold text-[13.5px] text-accent bg-accent-soft rounded-md py-2.5">
          {t("backHome")}
        </Link>
      </div>
      {error.digest && <div className="font-mono text-[11px] text-ink-faint mt-2">{t("errorCode", { code: error.digest })}</div>}
    </div>
  );
}
