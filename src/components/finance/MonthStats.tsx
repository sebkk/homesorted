"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useIncomeTypeLabel, useMonthFormat, usePeriodRange } from "@/i18n/useFormat";
import { useMoney } from "@/components/finance/MoneyContext";
import { useZoneData } from "@/lib/useZoneData";
import { useCategories } from "@/lib/useCategories";
import {
  allMonthsSorted,
  expensesForMonth,
  baseAmount,
  grossBase,
  incomesForMonth,
  monthBalance,
  monthExpenseTotal,
  monthHourlyRates,
  monthIncomeTotal,
  resolveIcon,
  savingsForMonth,
} from "@/lib/finance";
import { IncomeType, INCOME_TYPE_ICONS, INCOME_TYPES } from "@/lib/types";
import { SheetHeader } from "@/components/ui/Sheet";
import { ChevronIcon } from "@/components/finance/icons";
import { Donut, DonutSegment } from "@/components/finance/Donut";

// Fixed categorical order (validated adjacent + wrap-around, light & dark).
const SLOT_COLORS = ["var(--cat1)", "var(--cat2)", "var(--cat3)", "var(--cat4)", "var(--cat5)"];
const OTHER_COLOR = "var(--ink-faint)";
const TYPE_ORDER = INCOME_TYPES;

function sumBy<T>(items: T[], key: (x: T) => string, value: (x: T) => number): Map<string, number> {
  const m = new Map<string, number>();
  items.forEach((x) => m.set(key(x), (m.get(key(x)) ?? 0) + value(x)));
  return m;
}

export function MonthStats({
  zd,
  initialMonth,
  currentMonth,
  onClose,
}: {
  zd: ReturnType<typeof useZoneData>;
  initialMonth: string;
  currentMonth: string;
  onClose: () => void;
}) {
  const t = useTranslations("stats");
  const typeLabel = useIncomeTypeLabel();
  const { month: monthName } = useMonthFormat();
  const { fmt, symbol } = useMoney();
  const { incomes, expenses, recurring, recurringIncomes, savingsEntries } = zd;
  const categories = useCategories();
  const { period } = zd;
  const range = usePeriodRange();
  const [month, setMonth] = useState(initialMonth);

  const months = allMonthsSorted(incomes, expenses, [...recurring, ...recurringIncomes], currentMonth, period);
  const idx = months.indexOf(month);
  const prev = idx > 0 ? months[idx - 1] : null;
  const next = idx >= 0 && idx < months.length - 1 ? months[idx + 1] : null;

  const earned = monthIncomeTotal(incomes, recurringIncomes, month);
  const spent = monthExpenseTotal(expenses, recurring, month, period);
  const saved = savingsForMonth(savingsEntries, month, period);
  const { vat, vatSource, balance } = monthBalance(incomes, recurringIncomes, expenses, recurring, month, categories.roleOf, period);
  const rates = monthHourlyRates(incomes, recurringIncomes, expenses, recurring, month, categories.roleOf, period);

  // Colors follow the category, not its rank this month: the five biggest
  // categories across all months keep the same color while you page through
  // months; everything else is "Pozostałe" in neutral gray.
  const allTimeByCategory = sumBy(months.flatMap((m) => expensesForMonth(expenses, recurring, m, period)), (x) => x.category_id, (x) => baseAmount(x));
  const colored = [...allTimeByCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, SLOT_COLORS.length).map(([c]) => c);
  const colorOf = (categoryId: string) => {
    const i = colored.indexOf(categoryId);
    return i >= 0 ? SLOT_COLORS[i] : OTHER_COLOR;
  };

  const monthByCategory = sumBy(expensesForMonth(expenses, recurring, month, period), (x) => x.category_id, (x) => baseAmount(x));
  const byCategory = [...monthByCategory.entries()].map(([id, amount]) => ({ id, amount })).sort((a, b) => b.amount - a.amount);
  const otherSum = byCategory.filter((c) => !colored.includes(c.id)).reduce((s, c) => s + c.amount, 0);
  const expenseSegments: DonutSegment[] = [
    ...colored.filter((c) => monthByCategory.get(c)).map((c) => ({ key: c, label: categories.name(c), value: monthByCategory.get(c)!, color: colorOf(c) })),
    ...(otherSum > 0 ? [{ key: "__other", label: t("otherCategories"), value: otherSum, color: OTHER_COLOR }] : []),
  ];

  const monthByType = sumBy(incomesForMonth(incomes, recurringIncomes, month), (x) => x.type, (x) => grossBase(x));
  const byType = [...monthByType.entries()].map(([type, amount]) => ({ type: type as IncomeType, amount })).sort((a, b) => b.amount - a.amount);
  const typeColor = (type: IncomeType) => SLOT_COLORS[TYPE_ORDER.indexOf(type)];
  const incomeSegments: DonutSegment[] = TYPE_ORDER.filter((type) => monthByType.get(type)).map((type) => ({
    key: type,
    label: typeLabel(type),
    value: monthByType.get(type)!,
    color: typeColor(type),
  }));

  return (
    <>
      <SheetHeader title={t("title")} onClose={onClose} />
      <div className="flex items-center justify-between -mt-1">
        <MonthNavButton label={t("prevMonth")} disabled={!prev} onClick={() => prev && setMonth(prev)} direction="prev" />
        <div className="text-center">
          <div className="text-[15px] font-bold">{monthName(month)}</div>
          {range(month, period) && <div className="text-[11.5px] text-ink-faint">{range(month, period)}</div>}
        </div>
        <MonthNavButton label={t("nextMonth")} disabled={!next} onClick={() => next && setMonth(next)} direction="next" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Tile label={t("earnedGross")} value={fmt(earned)} tone="good" />
        <Tile label={t("spent")} value={fmt(spent)} tone="critical" />
        <Tile
          label={t("leftOver")}
          value={fmt(balance)}
          tone={balance >= 0 ? "good" : "critical"}
          note={vat > 0 ? t("afterVat", { vat: fmt(vat), source: vatSource }) : undefined}
        />
        <Tile label={t("savings")} value={fmt(saved)} />
        {rates.hours > 0 && (
          <>
            <Tile label={t("rateBeforeTax", { symbol })} value={fmt(rates.beforeTax, 2)} note={t("rateBeforeTaxNote", { hours: rates.hours })} />
            <Tile
              label={t("rateTakeHome", { symbol })}
              value={fmt(rates.takeHome, 2)}
              note={rates.zus + rates.tax > 0 ? t("rateTakeHomeNote", { zus: fmt(rates.zus), tax: fmt(rates.tax) }) : t("noZusTax")}
            />
          </>
        )}
      </div>

      <Breakdown
        title={t("byCategory")}
        total={spent}
        empty={t("noExpenses")}
        tone="critical"
        donut={expenseSegments.length >= 2 ? <Donut segments={expenseSegments} centerCaption={t("spent")} /> : null}
        rows={byCategory.map((c) => ({
          key: c.id,
          icon: resolveIcon(null, categories.icon(c.id)),
          label: categories.name(c.id),
          amount: c.amount,
          swatch: colorOf(c.id),
        }))}
      />
      <Breakdown
        title={t("byType")}
        total={earned}
        empty={t("noIncomes")}
        tone="good"
        donut={incomeSegments.length >= 2 ? <Donut segments={incomeSegments} centerCaption={t("earned")} /> : null}
        rows={byType.map((x) => ({
          key: x.type,
          icon: INCOME_TYPE_ICONS[x.type],
          label: typeLabel(x.type),
          amount: x.amount,
          swatch: typeColor(x.type),
        }))}
      />
    </>
  );
}

function MonthNavButton({
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
      className="w-8 h-8 rounded-md border border-border bg-surface-2 text-ink-muted flex items-center justify-center disabled:opacity-30"
    >
      <span style={{ transform: direction === "prev" ? "rotate(180deg)" : undefined }} className="flex">
        <ChevronIcon open={false} />
      </span>
    </button>
  );
}

function Tile({ label, value, tone, note }: { label: string; value: string; tone?: "good" | "critical"; note?: string }) {
  const color = tone === "good" ? "text-good" : tone === "critical" ? "text-critical" : "text-ink";
  return (
    <div className="bg-surface-2 border border-border rounded-md py-2.5 px-3">
      <div className="text-[11px] text-ink-muted font-medium">{label}</div>
      <div className={`tabular-nums text-[16px] font-bold mt-0.5 tracking-tight ${color}`}>{value}</div>
      {note && <div className="text-[10.5px] text-ink-faint mt-0.5 leading-snug">{note}</div>}
    </div>
  );
}

// Ranked bar list: one hue per list (magnitude, not identity), labels and
// values always printed so the bar length is never the only way to read it.
function Breakdown({
  title,
  total,
  rows,
  empty,
  tone,
  donut,
}: {
  title: string;
  total: number;
  rows: { key: string; icon: string; label: string; amount: number; swatch: string }[];
  empty: string;
  tone: "good" | "critical";
  donut: React.ReactNode;
}) {
  const { fmt } = useMoney();
  const max = Math.max(1, ...rows.map((r) => r.amount));
  const fill = tone === "good" ? "bg-good" : "bg-critical";
  return (
    <div>
      <div className="text-[12px] font-semibold text-ink-muted uppercase tracking-wide mb-2">{title}</div>
      {donut && <div className="mb-3.5">{donut}</div>}
      {rows.length === 0 ? (
        <div className="text-[12.5px] text-ink-muted">{empty}</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map((r) => (
            <div key={r.key}>
              <div className="flex items-center gap-2 text-[13px]">
                <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: r.swatch }} aria-hidden />
                <span className="shrink-0">{r.icon}</span>
                <span className="flex-1 min-w-0 truncate font-medium">{r.label}</span>
                <span className="tabular-nums font-semibold text-ink shrink-0">{fmt(r.amount)}</span>
                <span className="tabular-nums text-ink-muted text-[11.5px] w-9 text-right shrink-0">
                  {total > 0 ? Math.round((r.amount / total) * 100) : 0}%
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                <div className={`h-full rounded-full ${fill}`} style={{ width: `${(r.amount / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
