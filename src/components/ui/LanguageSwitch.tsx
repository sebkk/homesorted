"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { setLocale } from "@/i18n/actions";
import { LOCALES } from "@/i18n/config";

/** PL / EN segmented switch; the choice is kept in a cookie (see setLocale). */
export function LanguageSwitch({ className = "" }: { className?: string }) {
  const t = useTranslations("language");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div role="group" aria-label={t("label")} className={`inline-flex rounded-md border border-border bg-surface-2 p-0.5 ${className}`}>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={l === locale}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await setLocale(l);
              router.refresh();
            })
          }
          className={`text-[11.5px] font-semibold uppercase px-2.5 py-1 rounded-[5px] border-none ${
            l === locale ? "bg-accent-soft text-accent" : "bg-transparent text-ink-muted"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
