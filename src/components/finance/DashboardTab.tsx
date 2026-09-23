"use client";

import { useZoneData } from "@/lib/useZoneData";
import {
  allMonthsSorted,
  expensesForMonth,
  fmt,
  incomesForMonth,
  monthExpenseTotal,
  monthIncomeTotal,
  monthLabel,
  monthZlH,
  resolveIcon,
  savingsForMonth,
} from "@/lib/finance";
import { useCategories } from "@/lib/useCategories";
import { buildTransactionsCsv, downloadCsv } from "@/lib/exportCsv";
import { INCOME_TYPE_ICONS, INCOME_TYPE_LABELS } from "@/lib/types";
import { BalanceChart } from "@/components/finance/BalanceChart";

export function DashboardTab({
  zd,
  currentMonth,
  onAddIncome,
  onAddExpense,
  onEditBudgets,
}: {
  zd: ReturnType<typeof useZoneData>;
  currentMonth: string;
  onAddIncome: () => void;
  onAddExpense: () => void;
  onEditBudgets: () => void;
}) {
  const { incomes, expenses, recurring, recurringIncomes, savingsEntries } = zd;
  const templates = [...recurring, ...recurringIncomes];
  const categories = useCategories();
  const categoryIcon = (category: string) => categories.find((c) => c.name === category)?.icon;
  const earned = monthIncomeTotal(incomes, recurringIncomes, currentMonth);
  const expTotal = monthExpenseTotal(expenses, recurring, currentMonth);
  const balance = earned - expTotal;
  const zlH = monthZlH(incomes, recurringIncomes, currentMonth);

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
      category: b.category,
      limit: b.amount,
      spent: monthExpenses.filter((x) => x.category === b.category).reduce((s, x) => s + x.amount, 0),
      icon: resolveIcon(null, categoryIcon(b.category)),
    }))
    .sort((a, b) => b.spent / b.limit - a.spent / a.limit);

  const tx = [
    ...allIncomeOccurrences.map((x) => ({
      kind: "income" as const,
      date: `${x.month}-28`,
      title: x.desc && (x.type !== "b2b" || "recurring" in x) ? x.desc : INCOME_TYPE_LABELS[x.type],
      amount: x.amount,
      icon: resolveIcon(x.icon, INCOME_TYPE_ICONS[x.type]),
    })),
    ...allExpenseOccurrences.map((x) => ({
      kind: "expense" as const,
      date: x.date,
      title: x.desc || x.category,
      amount: x.amount,
      icon: resolveIcon(x.icon, categoryIcon(x.category)),
    })),
  ]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, 5);

  return (
    <div className="pb-2">
      <div className="mt-3.5 p-5 rounded-xl bg-surface-2 border border-border shadow-glass">
        <div className="text-[12.5px] text-ink-muted font-medium">Zostaje na czysto — {monthLabel(currentMonth)}</div>
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
          {balance >= 0 ? "Na plusie" : "Na minusie"}
        </span>
      </div>

      <div className="flex gap-2.5 mt-3">
        <button
          type="button"
          onClick={onAddIncome}
          className="flex-1 flex items-center justify-center gap-1.5 font-bold text-[13px] border-none rounded-md py-2.5 bg-good-soft text-good"
        >
          <PlusIcon /> Zarobek
        </button>
        <button
          type="button"
          onClick={onAddExpense}
          className="flex-1 flex items-center justify-center gap-1.5 font-bold text-[13px] border-none rounded-md py-2.5 bg-critical-soft text-critical"
        >
          <PlusIcon /> Wydatek
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2.5 mt-3.5">
        <StatTile label="Zarobek" value={fmt(earned)} />
        <StatTile label="Wydatki" value={fmt(expTotal)} valueClassName="text-critical" />
        <StatTile label="zł/h na czysto" value={fmt(zlH, 2)} />
      </div>

      <div className="text-[13px] font-semibold text-ink-muted uppercase tracking-wide mt-[22px] mb-2.5">
        Zarobki i wydatki — ostatnie miesiące
      </div>
      <div className="bg-surface-2 border border-border rounded-xl p-3.5 pt-4">
        <BalanceChart data={chartMonths} />
      </div>
      <div className="text-[10.5px] text-ink-faint text-right pt-1">Dotknij wykresu, by zobaczyć statystyki →</div>

      <div className="flex items-baseline justify-between mt-[22px] mb-2.5">
        <div className="text-[13px] font-semibold text-ink-muted uppercase tracking-wide">Budżety — {monthLabel(currentMonth)}</div>
        {budgetRows.length > 0 && (
          <button type="button" onClick={onEditBudgets} className="text-[12.5px] font-semibold text-accent bg-transparent border-none">
            Zmień
          </button>
        )}
      </div>
      {budgetRows.length === 0 ? (
        <button
          type="button"
          onClick={onEditBudgets}
          className="w-full text-left bg-surface-2 border border-dashed border-border rounded-md p-3.5 text-[13px] text-ink-muted"
        >
          Ustaw miesięczne limity na kategorie, żeby widzieć, ile zostało do wydania. <span className="text-accent font-semibold">Ustaw budżety</span>
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          {budgetRows.map((b) => (
            <BudgetRow key={b.category} {...b} />
          ))}
        </div>
      )}

      <div className="text-[13px] font-semibold text-ink-muted uppercase tracking-wide mt-[22px] mb-2.5">
        Ostatnie transakcje
      </div>
      {tx.length === 0 ? (
        <div className="text-center py-10 px-5 text-ink-muted text-[13px]">
          Brak transakcji. Dodaj pierwszą przez przycisk +.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {tx.map((t, i) => (
            <div key={i} className="bg-surface-2 border border-border rounded-md p-3 flex items-center gap-3">
              <span
                className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 text-[17px] ${
                  t.kind === "income" ? "bg-good-soft" : "bg-critical-soft"
                }`}
              >
                {t.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-semibold truncate">{t.title}</div>
                <div className="text-xs text-ink-muted mt-0.5">{t.date}</div>
              </div>
              <div className={`tabular-nums font-bold text-sm shrink-0 ${t.kind === "income" ? "text-good" : "text-critical"}`}>
                {t.kind === "income" ? "+" : "−"}
                {fmt(Math.abs(t.amount))}
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
              buildTransactionsCsv({ incomes, recurringIncomes, expenses, recurring, savingsEntries, currentMonth })
            )
          }
          className="w-full mt-4 font-semibold text-[13px] text-accent bg-accent-soft border-none rounded-md py-2.5"
        >
          Eksportuj wszystkie transakcje do CSV
        </button>
      )}
    </div>
  );
}

// Meter: fill color carries status (good / warning >= 80% / critical over),
// but the text line always states the same thing, so color is never the only cue.
function BudgetRow({ category, icon, spent, limit }: { category: string; icon: string; spent: number; limit: number }) {
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
        aria-label={`${category}: wydano ${fmt(spent)} z ${fmt(limit)}`}
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
          ? `⚠ Przekroczony o ${fmt(spent - limit)} (${pct}%)`
          : status === "warn"
            ? `⚠ ${pct}% — blisko limitu, zostało ${fmt(limit - spent)}`
            : `${pct}% · zostało ${fmt(limit - spent)}`}
      </div>
    </div>
  );
}

function StatTile({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="bg-surface-2 border border-border rounded-md py-3 px-2.5">
      <div className="text-[11px] text-ink-muted font-medium">{label}</div>
      <div className={`tabular-nums text-[16px] font-bold mt-1 tracking-tight ${valueClassName ?? ""}`}>{value}</div>
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
