"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { monthLabel, monthLabelGenitive, monthShort, periodRange, type MonthPeriod } from "@/lib/finance";
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

/** Formats a "YYYY-MM-DD" date for lists: "23 wrz 2026" / "23 Sept 2026".
 * Parsed as a local calendar date, so no time zone can shift the day. */
export function useDateFormat(): (isoDate: string) => string {
  const locale = useIntlLocale();
  return useMemo(() => {
    const f = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });
    return (isoDate: string) => {
      const [y, m, d] = isoDate.split("-").map(Number);
      return y && m && d ? f.format(new Date(y, m - 1, d)) : isoDate;
    };
  }, [locale]);
}

/** "10 wrz – 9 paź" for a zone month that isn't a calendar month; null for
 * calendar months, where the month name already says it all. */
export function usePeriodRange(): (key: string, p: MonthPeriod) => string | null {
  const locale = useIntlLocale();
  return useMemo(() => {
    const f = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
    const toDate = (iso: string) => {
      const [y, m, d] = iso.split("-").map(Number);
      return new Date(y, m - 1, d);
    };
    return (key: string, p: MonthPeriod) => {
      if (p.startDay <= 1) return null;
      const { start, end } = periodRange(key, p);
      return `${f.format(toDate(start))} – ${f.format(toDate(end))}`;
    };
  }, [locale]);
}

/** Writes a stored number the way the user types it into a form field —
 * "12,34" in Polish, "12.34" in English (forms accept either on input). */
export function useInputNumber(): (n: number) => string {
  const locale = useIntlLocale();
  return useMemo(() => {
    const decimal = new Intl.NumberFormat(locale).formatToParts(1.1).find((p) => p.type === "decimal")?.value ?? ".";
    return (n: number) => String(n).replace(".", decimal);
  }, [locale]);
}

/** Translated income type label ("Faktura B2B" / "B2B invoice"). */
export function useIncomeTypeLabel(): (type: IncomeType) => string {
  const t = useTranslations("incomeTypes");
  return t;
}
