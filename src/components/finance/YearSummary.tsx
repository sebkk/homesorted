"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMoney } from "@/components/finance/MoneyContext";
import { ChevronIcon } from "@/components/finance/icons";

export interface YearTotals {
  /** Sum for the year in the zone's currency. */
  total: number;
  /** Months of that year with any activity — the average is over these. */
  months: number;
  /** Optional secondary figure (e.g. net income), already formatted. */
  extra?: string;
}

/** Year total with prev/next year navigation; defaults to the current year. */
export function YearSummary({
  years,
  initialYear,
  tone,
  label,
  totalsFor,
}: {
  years: string[];
  initialYear: string;
  tone: "good" | "critical";
  label: (year: string) => string;
  totalsFor: (year: string) => YearTotals;
}) {
  const t = useTranslations("yearSummary");
  const { fmt } = useMoney();
  const [year, setYear] = useState(years.includes(initialYear) ? initialYear : years[years.length - 1]);
  if (!year) return null;

  const idx = years.indexOf(year);
  const prev = idx > 0 ? years[idx - 1] : null;
  const next = idx < years.length - 1 ? years[idx + 1] : null;
  const { total, months, extra } = totalsFor(year);
  const color = tone === "good" ? "text-good" : "text-critical";

  return (
    <div className="mt-3.5 mb-[22px] p-4 rounded-xl bg-surface-2 border border-border shadow-glass">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[12.5px] text-ink-muted font-medium">{label(year)}</div>
        {years.length > 1 && (
          <div className="flex items-center gap-1.5">
            <YearButton label={t("prev")} disabled={!prev} onClick={() => prev && setYear(prev)} direction="prev" />
            <YearButton label={t("next")} disabled={!next} onClick={() => next && setYear(next)} direction="next" />
          </div>
        )}
      </div>
      <div className={`tabular-nums font-bold tracking-tight text-[30px] mt-0.5 ${color}`}>{fmt(total)}</div>
      <div className="text-[11.5px] text-ink-muted mt-1 tabular-nums">
        {[extra, months > 0 ? t("average", { amount: fmt(total / months), count: months }) : null].filter(Boolean).join(" · ")}
      </div>
    </div>
  );
}

function YearButton({
  label,
  disabled,
  onClick,
  direction,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  direction: "prev" | "next";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="w-7 h-7 rounded-md border border-border bg-surface-2 text-ink-muted flex items-center justify-center disabled:opacity-30"
    >
      <span style={{ transform: direction === "prev" ? "rotate(180deg)" : undefined }} className="flex">
        <ChevronIcon open={false} size={13} />
      </span>
    </button>
  );
}
