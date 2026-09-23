"use client";

import { useZoneData } from "@/lib/useZoneData";
import {
  allMonthsSorted,
  expensesForMonth,
  fmt,
  monthExpenseTotal,
  monthIncomeTotal,
  monthLabel,
  monthZlH,
  savingsForMonth,
} from "@/lib/finance";
import { INCOME_TYPE_LABELS } from "@/lib/types";
import { BalanceChart } from "@/components/finance/BalanceChart";

export function DashboardTab({
  zd,
  currentMonth,
  onAddIncome,
  onAddExpense,
}: {
  zd: ReturnType<typeof useZoneData>;
  currentMonth: string;
  onAddIncome: () => void;
  onAddExpense: () => void;
}) {
  const { incomes, expenses, recurring, savingsEntries } = zd;
  const earned = monthIncomeTotal(incomes, currentMonth);
  const expTotal = monthExpenseTotal(expenses, recurring, currentMonth);
  const balance = earned - expTotal;
  const zlH = monthZlH(incomes, currentMonth);

  const months = allMonthsSorted(incomes, expenses, recurring, currentMonth).slice(-6);
  const chartMonths = (months.length ? months : [currentMonth]).map((m) => ({
    month: m,
    income: monthIncomeTotal(incomes, m),
    expense: monthExpenseTotal(expenses, recurring, m),
    saving: savingsForMonth(savingsEntries, m),
  }));

  const allExpenseOccurrences = allMonthsSorted(incomes, expenses, recurring, currentMonth).flatMap((m) =>
    expensesForMonth(expenses, recurring, m)
  );

  const tx = [
    ...incomes.map((x) => ({
      kind: "income" as const,
      date: `${x.month}-28`,
      title: x.type !== "b2b" && x.desc ? x.desc : INCOME_TYPE_LABELS[x.type],
      amount: x.amount,
    })),
    ...allExpenseOccurrences.map((x) => ({
      kind: "expense" as const,
      date: x.date,
      title: x.desc || x.category,
      amount: x.amount,
    })),
  ]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
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
                className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${
                  t.kind === "income" ? "bg-good-soft text-good" : "bg-critical-soft text-critical"
                }`}
              >
                {t.kind === "income" ? <ArrowUpIcon /> : <ArrowDownIcon />}
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
function ArrowUpIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}
function ArrowDownIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
      <path d="M12 5v14M5 12l7 7 7-7" />
    </svg>
  );
}
