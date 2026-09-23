"use client";

import { useTranslations } from "next-intl";
import { useIncomeTypeLabel, useMonthFormat } from "@/i18n/useFormat";
import { useZoneData } from "@/lib/useZoneData";
import { useMoney } from "@/components/finance/MoneyContext";
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
import { useCategories } from "@/lib/useCategories";
import { buildTransactionsCsv, downloadCsv } from "@/lib/exportCsv";
import { INCOME_TYPE_ICONS } from "@/lib/types";
import { BalanceChart } from "@/components/finance/BalanceChart";

export function DashboardTab({
  zd,
  currentMonth,
  onAddIncome,
  onAddExpense,
  onEditBudgets,
  onOpenStats,
}: {
  zd: ReturnType<typeof useZoneData>;
  currentMonth: string;
  onAddIncome: () => void;
  onAddExpense: () => void;
  onEditBudgets: () => void;
  onOpenStats: (month: string) => void;
}) {
  const t = useTranslations("dashboard");
  const ts = useTranslations("stats");
  const tCsv = useTranslations("csv");
  const typeLabel = useIncomeTypeLabel();
  const { month: monthName } = useMonthFormat();
  const { fmt, symbol, currency } = useMoney();
  const { incomes, expenses, recurring, recurringIncomes, savingsEntries } = zd;
  const templates = [...recurring, ...recurringIncomes];
  const categories = useCategories();
  const earned = monthIncomeTotal(incomes, recurringIncomes, currentMonth);
  const expTotal = monthExpenseTotal(expenses, recurring, currentMonth);
  const { vat, spent: balanceSpent, balance } = monthBalance(incomes, recurringIncomes, expenses, recurring, currentMonth, categories.roleOf);
  const rates = monthHourlyRates(incomes, recurringIncomes, expenses, recurring, currentMonth, categories.roleOf);

  const months = allMonthsSorted(incomes, expenses, templates, currentMonth).slice(-6);
  const chartMonths = (months.length ? months : [currentMonth]).map((m) => ({
    month: m,
    income: monthIncomeTotal(incomes, recurringIncomes, m),
    expense: monthExpenseTotal(expenses, recurring, m),
    saving: savingsForMonth(savingsEntries, m),
  }));

  const activityMonths = allMonthsSorted(incomes, expenses, templates, currentMonth);
  const allExpenseOccurrences = activityMonths.flatMap((m) => expensesForMonth(expenses, recurring, m));
  const allIncomeOccurrences = activityMonths.flatMap((m) => incomesForMonth(incomes, recurringIncomes, m));

  const monthExpenses = expensesForMonth(expenses, recurring, currentMonth);
  const budgetRows = zd.budgets
    .map((b) => ({
      id: b.category_id,
      category: categories.name(b.category_id),
      limit: b.amount,
      spent: monthExpenses.filter((x) => x.category_id === b.category_id).reduce((s, x) => s + baseAmount(x), 0),
      icon: resolveIcon(null, categories.icon(b.category_id)),
    }))
    .sort((a, b) => b.spent / b.limit - a.spent / a.limit);

  const tx = [
    ...allIncomeOccurrences.map((x) => ({
      kind: "income" as const,
      date: `${x.month}-28`,
      title: x.desc && (x.type !== "b2b" || "recurring" in x) ? x.desc : typeLabel(x.type),
      amount: grossBase(x),
      icon: resolveIcon(x.icon, INCOME_TYPE_ICONS[x.type]),
    })),
    ...allExpenseOccurrences.map((x) => ({
      kind: "expense" as const,
      date: x.date,
      title: x.desc || categories.name(x.category_id),
      amount: baseAmount(x),
      icon: resolveIcon(x.icon, categories.icon(x.category_id)),
    })),
  ]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, 5);

  return (
    <div className="pb-2">
      <div className="mt-3.5 p-5 rounded-xl bg-surface-2 border border-border shadow-glass">
        <div className="text-[12.5px] text-ink-muted font-medium">{t("leftOverIn", { month: monthName(currentMonth) })}</div>
        <div
          className="tabular-nums font-bold tracking-tight text-[38px] mt-1 flex items-baseline gap-2"
          style={{ color: balance >= 0 ? "var(--good)" : "var(--critical)" }}
        >
          {fmt(balance)}
        </div>
        <span
          className={`text-[11.5px] font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1 mt-2.5 ${
            balance >= 0 ? "bg-good-soft text-good" : "bg-critical-soft text-critical"
          }`}
        >
          {balance >= 0 ? t("positive") : t("negative")}
        </span>
        <div className="text-[11.5px] text-ink-muted mt-2.5 tabular-nums">
          {vat > 0
            ? t("breakdownVat", { earned: fmt(earned), vat: fmt(vat), spent: fmt(balanceSpent) })
            : t("breakdown", { earned: fmt(earned), spent: fmt(balanceSpent) })}
        </div>
      </div>

      <div className="flex gap-2.5 mt-3">
        <button
          type="button"
          onClick={onAddIncome}
          className="flex-1 flex items-center justify-center gap-1.5 font-bold text-[13px] border-none rounded-md py-2.5 bg-good-soft text-good"
        >
          <PlusIcon /> {t("addIncome")}
        </button>
        <button
          type="button"
          onClick={onAddExpense}
          className="flex-1 flex items-center justify-center gap-1.5 font-bold text-[13px] border-none rounded-md py-2.5 bg-critical-soft text-critical"
        >
          <PlusIcon /> {t("addExpense")}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mt-3.5">
        <StatTile label={ts("earnedGross")} value={fmt(earned)} />
        <StatTile label={ts("spent")} value={fmt(expTotal)} valueClassName="text-critical" />
        <StatTile
          label={ts("rateBeforeTax", { symbol })}
          value={rates.hours > 0 ? fmt(rates.beforeTax, 2) : "—"}
          note={rates.hours > 0 ? t("beforeTaxNote") : t("addHours")}
        />
        <StatTile
          label={ts("rateTakeHome", { symbol })}
          value={rates.hours > 0 ? fmt(rates.takeHome, 2) : "—"}
          note={
            rates.hours === 0
              ? t("addHours")
              : rates.zus + rates.tax > 0
                ? t("takeHomeNote", { amount: fmt(rates.zus + rates.tax) })
                : t("noZusTax")
          }
        />
      </div>

      <div className="text-[13px] font-semibold text-ink-muted uppercase tracking-wide mt-[22px] mb-2.5">
        {t("chartTitle")}
      </div>
      <div className="bg-surface-2 border border-border rounded-xl p-3.5 pt-4">
        <BalanceChart data={chartMonths} onBarClick={onOpenStats} />
      </div>
      <div className="text-[10.5px] text-ink-faint text-right pt-1">{t("chartHint")}</div>

      <div className="flex items-baseline justify-between mt-[22px] mb-2.5">
        <div className="text-[13px] font-semibold text-ink-muted uppercase tracking-wide">{t("budgetsIn", { month: monthName(currentMonth) })}</div>
        {budgetRows.length > 0 && (
          <button type="button" onClick={onEditBudgets} className="text-[12.5px] font-semibold text-accent bg-transparent border-none">
            {t("change")}
          </button>
        )}
      </div>
      {budgetRows.length === 0 ? (
        <button
          type="button"
          onClick={onEditBudgets}
          className="w-full text-left bg-surface-2 border border-dashed border-border rounded-md p-3.5 text-[13px] text-ink-muted"
        >
          {t("budgetsEmpty")} <span className="text-accent font-semibold">{t("budgetsSet")}</span>
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          {budgetRows.map((b) => (
            <BudgetRow key={b.id} {...b} />
          ))}
        </div>
      )}

      <div className="text-[13px] font-semibold text-ink-muted uppercase tracking-wide mt-[22px] mb-2.5">
        {t("recent")}
      </div>
      {tx.length === 0 ? (
        <div className="text-center py-10 px-5 text-ink-muted text-[13px]">
          {t("noTransactions")}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {tx.map((row, i) => (
            <div key={i} className="bg-surface-2 border border-border rounded-md p-3 flex items-center gap-3">
              <span
                className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 text-[17px] ${
                  row.kind === "income" ? "bg-good-soft" : "bg-critical-soft"
                }`}
              >
                {row.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-semibold truncate">{row.title}</div>
                <div className="text-xs text-ink-muted mt-0.5">{row.date}</div>
              </div>
              <div className={`tabular-nums font-bold text-sm shrink-0 ${row.kind === "income" ? "text-good" : "text-critical"}`}>
                {row.kind === "income" ? "+" : "−"}
                {fmt(Math.abs(row.amount))}
              </div>
            </div>
          ))}
        </div>
      )}

      {(allIncomeOccurrences.length > 0 || allExpenseOccurrences.length > 0 || savingsEntries.length > 0) && (
        <button
          type="button"
          onClick={() =>
            downloadCsv(
              `homesorted-${currentMonth}.csv`,
              buildTransactionsCsv({ incomes, recurringIncomes, expenses, recurring, savingsEntries, currentMonth, categoryName: categories.name, incomeTypeLabel: typeLabel, zoneCurrency: currency, t: tCsv })
            )
          }
          className="w-full mt-4 font-semibold text-[13px] text-accent bg-accent-soft border-none rounded-md py-2.5"
        >
          {t("exportCsv")}
        </button>
      )}
    </div>
  );
}

// Meter: fill color carries status (good / warning >= 80% / critical over),
// but the text line always states the same thing, so color is never the only cue.
function BudgetRow({ category, icon, spent, limit }: { category: string; icon: string; spent: number; limit: number }) {
  const t = useTranslations("dashboard");
  const { fmt } = useMoney();
  const ratio = spent / limit;
  const status = ratio > 1 ? "over" : ratio >= 0.8 ? "warn" : "ok";
  const fill = status === "over" ? "bg-critical" : status === "warn" ? "bg-warning" : "bg-good";
  const pct = Math.round(ratio * 100);

  return (
    <div className="bg-surface-2 border border-border rounded-md p-3">
      <div className="flex items-center gap-2.5">
        <span className="text-[17px] shrink-0">{icon}</span>
        <span className="flex-1 min-w-0 text-[13.5px] font-semibold truncate">{category}</span>
        <span className="tabular-nums text-[12.5px] font-semibold text-ink shrink-0">
          {fmt(spent)} <span className="text-ink-muted font-medium">/ {fmt(limit)}</span>
        </span>
      </div>
      <div
        role="meter"
        aria-label={t("budgetAria", { category, spent: fmt(spent), limit: fmt(limit) })}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(spent, limit)}
        className="mt-2 h-1.5 rounded-full overflow-hidden"
        style={{ background: "var(--border)" }}
      >
        <div className={`h-full rounded-full ${fill}`} style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
      </div>
      <div className="mt-1.5 text-[11.5px] text-ink-muted tabular-nums">
        {status === "over"
          ? `⚠ ${t("budgetOver", { amount: fmt(spent - limit), pct })}`
          : status === "warn"
            ? `⚠ ${t("budgetWarn", { amount: fmt(limit - spent), pct })}`
            : t("budgetOk", { amount: fmt(limit - spent), pct })}
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  valueClassName,
  note,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  note?: string;
}) {
  return (
    <div className="bg-surface-2 border border-border rounded-md py-3 px-2.5">
      <div className="text-[11px] text-ink-muted font-medium">{label}</div>
      <div className={`tabular-nums text-[16px] font-bold mt-1 tracking-tight ${valueClassName ?? ""}`}>{value}</div>
      {note && <div className="text-[10.5px] text-ink-faint mt-0.5 leading-snug">{note}</div>}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
