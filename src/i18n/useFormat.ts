"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { monthLabel, monthLabelGenitive, monthShort } from "@/lib/finance";
import { IncomeType } from "@/lib/types";
import { INTL_LOCALE, toLocale } from "./config";

/** BCP 47 tag of the current UI language, for Intl formatting. */
export function useIntlLocale(): string {
  return INTL_LOCALE[toLocale(useLocale())];
}

/** Month formatters bound to the current UI language. */
export function useMonthFormat() {
  const locale = useIntlLocale();
  return useMemo(
    () => ({
      /** "Wrzesień 2026" / "September 2026" */
      month: (key: string) => monthLabel(key, locale),
      /** Form used after "od"/"do": "września 2026" / "September 2026" */
      monthIn: (key: string) => monthLabelGenitive(key, locale),
      /** "Wrz" / "Sep" */
      monthShort: (key: string) => monthShort(key, locale),
    }),
    [locale]
  );
}

/** Translated income type label ("Faktura B2B" / "B2B invoice"). */
export function useIncomeTypeLabel(): (type: IncomeType) => string {
  const t = useTranslations("incomeTypes");
  return t;
}
