import {
  AnyExpense,
  AnyIncome,
  Expense,
  Income,
  MONTHS,
  MONTHS_GENITIVE,
  RecurringExpense,
  RecurringIncome,
  RecurringIncomeOccurrence,
  RecurringOccurrence,
  RecurringTemplate,
  SavingsEntry,
} from "./types";

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

const DEFAULT_ICON = "📦";

/** A per-entry icon override, falling back to the category/type default, then a generic fallback. */
export function resolveIcon(entryIcon: string | null | undefined, defaultIcon: string | undefined): string {
  return entryIcon || defaultIcon || DEFAULT_ICON;
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

/** Genitive form for use after "od"/"do", e.g. "od sierpnia 2026". */
export function monthLabelGenitive(key: string): string {
  const [y, m] = key.split("-");
  return `${MONTHS_GENITIVE[parseInt(m, 10) - 1]} ${y}`;
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

export function prevMonth(m: string): string {
  const [yStr, moStr] = m.split("-");
  let y = parseInt(yStr, 10);
  let mo = parseInt(moStr, 10) - 1;
  if (mo < 1) {
    mo = 12;
    y--;
  }
  return `${y}-${pad2(mo)}`;
}

export function todayStr(d = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function currentMonthStr(d = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export function daysInMonth(monthKey: string): number {
  const [yStr, mStr] = monthKey.split("-");
  return new Date(parseInt(yStr, 10), parseInt(mStr, 10), 0).getDate();
}

/** Whether a recurring template (expense or income) applies in `monthKey`:
 * start_month inclusive, end_month an exclusive forward-only cutoff, and
 * skip_months one-off exceptions. */
export function isActiveInMonth(t: Pick<RecurringTemplate, "start_month" | "end_month" | "skip_months">, monthKey: string): boolean {
  return t.start_month <= monthKey && (!t.end_month || monthKey < t.end_month) && !t.skip_months.includes(monthKey);
}

export function recurringForMonth(recurring: RecurringExpense[], monthKey: string): RecurringOccurrence[] {
  return recurring
    .filter((r) => isActiveInMonth(r, monthKey))
    .map((r) => ({
      id: `rec_${r.id}_${monthKey}`,
      // Clamp to the month's last day — e.g. a day-31 template still fires in February.
      date: `${monthKey}-${pad2(Math.min(r.day_of_month, daysInMonth(monthKey)))}`,
      category: r.category,
      desc: r.desc,
      amount: r.amount,
      icon: r.icon,
      recurring: true as const,
      templateId: r.id,
      month: monthKey,
    }));
}

export function recurringIncomesForMonth(recurring: RecurringIncome[], monthKey: string): RecurringIncomeOccurrence[] {
  return recurring
    .filter((r) => isActiveInMonth(r, monthKey))
    .map((r) => ({
      id: `reci_${r.id}_${monthKey}`,
      month: monthKey,
      type: r.type,
      hours: r.hours,
      amount: r.amount,
      desc: r.desc,
      icon: r.icon,
      recurring: true as const,
      templateId: r.id,
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

export function incomesForMonth(incomes: Income[], recurring: RecurringIncome[], monthKey: string): AnyIncome[] {
  return [...incomes.filter((x) => x.month === monthKey), ...recurringIncomesForMonth(recurring, monthKey)];
}

export function monthIncomeTotal(incomes: Income[], recurring: RecurringIncome[], monthKey: string): number {
  return incomesForMonth(incomes, recurring, monthKey).reduce((s, x) => s + x.amount, 0);
}

export function monthZlH(incomes: Income[], recurring: RecurringIncome[], monthKey: string): number {
  const items = incomesForMonth(incomes, recurring, monthKey);
  const hours = items.reduce((s, x) => s + (x.hours || 0), 0);
  const amount = items.reduce((s, x) => s + (x.hours ? x.amount : 0), 0);
  return hours > 0 ? amount / hours : 0;
}

/** All months that have any activity, sorted ascending, including every month
 * from a recurring template's start (expense or income) up to `currentMonth`. */
export function allMonthsSorted(
  incomes: Income[],
  expenses: Expense[],
  templates: Pick<RecurringTemplate, "start_month">[],
  currentMonth: string
): string[] {
  const set = new Set<string>();
  incomes.forEach((x) => set.add(x.month));
  expenses.forEach((x) => set.add(x.date.slice(0, 7)));
  templates.forEach((r) => {
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
