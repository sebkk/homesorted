import {
  AnyExpense,
  Expense,
  Income,
  MONTHS,
  RecurringExpense,
  RecurringOccurrence,
  SavingsEntry,
} from "./types";

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function fmt(n: number, dec = 0): string {
  const v = Math.round((n + Number.EPSILON) * Math.pow(10, dec)) / Math.pow(10, dec);
  return (
    new Intl.NumberFormat("pl-PL", {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    }).format(v) + " zł"
  );
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

export function monthShort(key: string): string {
  const [, m] = key.split("-");
  return MONTHS[parseInt(m, 10) - 1].slice(0, 3);
}

export function nextMonth(m: string): string {
  const [yStr, moStr] = m.split("-");
  let y = parseInt(yStr, 10);
  let mo = parseInt(moStr, 10) + 1;
  if (mo > 12) {
    mo = 1;
    y++;
  }
  return `${y}-${pad2(mo)}`;
}

export function todayStr(d = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function currentMonthStr(d = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/** Expands one recurring template into an occurrence for `monthKey`, honoring
 * startMonth / endMonth (forward-only cutoff) / skipMonths (one-off exception). */
export function recurringForMonth(
  recurring: RecurringExpense[],
  monthKey: string
): RecurringOccurrence[] {
  return recurring
    .filter(
      (r) =>
        r.start_month <= monthKey &&
        (!r.end_month || monthKey < r.end_month) &&
        !r.skip_months.includes(monthKey)
    )
    .map((r) => ({
      id: `rec_${r.id}_${monthKey}`,
      date: `${monthKey}-${pad2(r.day_of_month)}`,
      category: r.category,
      desc: r.desc,
      amount: r.amount,
      recurring: true as const,
      templateId: r.id,
      month: monthKey,
    }));
}

export function expensesForMonth(
  expenses: Expense[],
  recurring: RecurringExpense[],
  monthKey: string
): AnyExpense[] {
  return [
    ...expenses.filter((x) => x.date.slice(0, 7) === monthKey),
    ...recurringForMonth(recurring, monthKey),
  ];
}

export function monthExpenseTotal(
  expenses: Expense[],
  recurring: RecurringExpense[],
  monthKey: string
): number {
  return expensesForMonth(expenses, recurring, monthKey).reduce((s, x) => s + x.amount, 0);
}

export function incomesForMonth(incomes: Income[], monthKey: string): Income[] {
  return incomes.filter((x) => x.month === monthKey);
}

export function monthIncomeTotal(incomes: Income[], monthKey: string): number {
  return incomesForMonth(incomes, monthKey).reduce((s, x) => s + x.amount, 0);
}

export function monthZlH(incomes: Income[], monthKey: string): number {
  const items = incomesForMonth(incomes, monthKey);
  const hours = items.reduce((s, x) => s + (x.hours || 0), 0);
  const amount = items.reduce((s, x) => s + (x.hours ? x.amount : 0), 0);
  return hours > 0 ? amount / hours : 0;
}

/** All months that have any activity, sorted ascending, including future
 * months a still-active recurring template would touch up to `currentMonth`. */
export function allMonthsSorted(
  incomes: Income[],
  expenses: Expense[],
  recurring: RecurringExpense[],
  currentMonth: string
): string[] {
  const set = new Set<string>();
  incomes.forEach((x) => set.add(x.month));
  expenses.forEach((x) => set.add(x.date.slice(0, 7)));
  recurring.forEach((r) => {
    let m = r.start_month;
    let guard = 0;
    while (m <= currentMonth && guard < 240) {
      set.add(m);
      m = nextMonth(m);
      guard++;
    }
  });
  return Array.from(set).sort();
}

export function savingsBalance(initial: number, entries: SavingsEntry[]): number {
  return initial + entries.reduce((sum, e) => sum + e.amount, 0);
}

export function savingsForMonth(entries: SavingsEntry[], monthKey: string): number {
  return entries
    .filter((e) => e.date.slice(0, 7) === monthKey)
    .reduce((sum, e) => sum + e.amount, 0);
}

export interface CategoryTotal {
  category: string;
  amount: number;
}

export function categoryBreakdown(
  expenses: Expense[],
  recurring: RecurringExpense[],
  months: string[]
): CategoryTotal[] {
  const totals: Record<string, number> = {};
  months.forEach((m) => {
    expensesForMonth(expenses, recurring, m).forEach((x) => {
      totals[x.category] = (totals[x.category] || 0) + x.amount;
    });
  });
  let arr = Object.entries(totals)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
  if (arr.length > 8) {
    const top = arr.slice(0, 7);
    const restSum = arr.slice(7).reduce((s, x) => s + x.amount, 0);
    top.push({ category: "Pozostałe", amount: restSum });
    arr = top;
  }
  return arr;
}
