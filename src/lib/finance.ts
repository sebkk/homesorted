import {
  AnyExpense,
  AnyIncome,
  CategoryRole,
  Expense,
  Income,
  RecurringExpense,
  RecurringIncome,
  RecurringIncomeOccurrence,
  RecurringOccurrence,
  RecurringTemplate,
  SavingsEntry,
} from "./types";

/** Gross amount for an income stored as net (+ its VAT rate), in the entry's own currency. */
export function grossAmount(x: { amount: number; vat_rate: number }): number {
  return Math.round(x.amount * (1 + (Number(x.vat_rate) || 0)) * 100) / 100;
}

/** An entry's value in its zone's currency: amount * NBP rate (1 for same currency). */
export function baseAmount(x: { amount: number; fx_rate?: number }): number {
  return x.amount * (Number(x.fx_rate) || 1);
}

/** Gross income converted into the zone's currency. */
export function grossBase(x: { amount: number; vat_rate: number; fx_rate?: number }): number {
  return grossAmount(x) * (Number(x.fx_rate) || 1);
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

const DEFAULT_ICON = "📦";

/** A per-entry icon override, falling back to the category/type default, then a generic fallback. */
export function resolveIcon(entryIcon: string | null | undefined, defaultIcon: string | undefined): string {
  return entryIcon || defaultIcon || DEFAULT_ICON;
}

export function fmt(n: number, dec = 2, currency = "PLN", locale = "pl-PL"): string {
  const v = Math.round((n + Number.EPSILON) * Math.pow(10, dec)) / Math.pow(10, dec);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(v);
}

function monthDate(key: string): Date {
  const [y, m] = key.split("-");
  return new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
}

function capitalize(s: string, locale: string): string {
  return s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
}

/** "Wrzesień 2026" / "September 2026". `locale` is a BCP 47 tag (see INTL_LOCALE). */
export function monthLabel(key: string, locale = "pl-PL"): string {
  const d = monthDate(key);
  const name = new Intl.DateTimeFormat(locale, { month: "long" }).format(d);
  return `${capitalize(name, locale)} ${d.getFullYear()}`;
}

/** Month name in the form used inside a date — the genitive in Polish
 * ("od września 2026"), identical to the plain name in English. */
export function monthLabelGenitive(key: string, locale = "pl-PL"): string {
  const d = monthDate(key);
  const name = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" })
    .formatToParts(d)
    .find((p) => p.type === "month")!.value;
  return `${name} ${d.getFullYear()}`;
}

export function monthShort(key: string, locale = "pl-PL"): string {
  const name = new Intl.DateTimeFormat(locale, { month: "long" }).format(monthDate(key));
  return capitalize(name.slice(0, 3), locale);
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

export function lastDayOfMonth(monthKey: string): string {
  return `${monthKey}-${pad2(daysInMonth(monthKey))}`;
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
      category_id: r.category_id,
      desc: r.desc,
      amount: r.amount,
      icon: r.icon,
      currency: r.currency,
      fx_rate: r.fx_by_month?.[monthKey] ?? r.fx_rate,
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
      vat_rate: Number(r.vat_rate) || 0,
      currency: r.currency,
      fx_rate: r.fx_by_month?.[monthKey] ?? r.fx_rate,
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
  return expensesForMonth(expenses, recurring, monthKey).reduce((s, x) => s + baseAmount(x), 0);
}

export function incomesForMonth(incomes: Income[], recurring: RecurringIncome[], monthKey: string): AnyIncome[] {
  return [...incomes.filter((x) => x.month === monthKey), ...recurringIncomesForMonth(recurring, monthKey)];
}

/** Gross (with VAT) income for the month — what's shown as "Zarobek". */
export function monthIncomeTotal(incomes: Income[], recurring: RecurringIncome[], monthKey: string): number {
  return incomesForMonth(incomes, recurring, monthKey).reduce((s, x) => s + grossBase(x), 0);
}

export function monthIncomeNet(incomes: Income[], recurring: RecurringIncome[], monthKey: string): number {
  return incomesForMonth(incomes, recurring, monthKey).reduce((s, x) => s + baseAmount(x), 0);
}

/** Resolves a category id to its role (ZUS / income tax / VAT) — see useCategories. */
export type RoleOf = (categoryId: string) => CategoryRole | null;

function roleSum(expenses: Expense[], recurring: RecurringExpense[], monthKey: string, roleOf: RoleOf, role: CategoryRole): number {
  return expensesForMonth(expenses, recurring, monthKey)
    .filter((x) => roleOf(x.category_id) === role)
    .reduce((s, x) => s + baseAmount(x), 0);
}

export type VatSource = "paid" | "invoice";

/** The VAT to take off a month's income. When the month has expenses in the
 * VAT category, those are what was actually paid to the tax office — already
 * reduced by the VAT deducted on purchases — so they're used as-is. Only when
 * there are none does it fall back to the full VAT charged on the invoices.
 * `factor` scales each invoice's own VAT to match (1 for "invoice"). */
export function monthVat(
  incomes: Income[],
  recurringIncomes: RecurringIncome[],
  expenses: Expense[],
  recurring: RecurringExpense[],
  monthKey: string,
  roleOf: RoleOf
): { vat: number; source: VatSource; factor: number } {
  const invoiceVat = monthIncomeTotal(incomes, recurringIncomes, monthKey) - monthIncomeNet(incomes, recurringIncomes, monthKey);
  const hasPaid = expensesForMonth(expenses, recurring, monthKey).some((x) => roleOf(x.category_id) === "vat");
  if (!hasPaid) return { vat: invoiceVat, source: "invoice", factor: 1 };
  const paid = roleSum(expenses, recurring, monthKey, roleOf, "vat");
  return { vat: paid, source: "paid", factor: invoiceVat > 0 ? paid / invoiceVat : 0 };
}

/** An income's net value after the month's VAT, in the entry's own currency:
 * gross minus its invoice VAT scaled by monthVat's `factor` — so it's the
 * invoice net when no VAT payment is recorded, and reflects the VAT actually
 * paid (after deductions) when one is. */
export function netAfterVat(x: { amount: number; vat_rate: number }, factor: number): number {
  const gross = grossAmount(x);
  return gross - (gross - x.amount) * factor;
}

/** "Zostaje na czysto": gross income minus the month's VAT (see monthVat)
 * minus expenses. Expenses in the VAT category are left out of `spent` so VAT
 * isn't taken off twice. */
export function monthBalance(
  incomes: Income[],
  recurringIncomes: RecurringIncome[],
  expenses: Expense[],
  recurring: RecurringExpense[],
  monthKey: string,
  roleOf: RoleOf
) {
  const gross = monthIncomeTotal(incomes, recurringIncomes, monthKey);
  const { vat, source } = monthVat(incomes, recurringIncomes, expenses, recurring, monthKey, roleOf);
  const spent = monthExpenseTotal(expenses, recurring, monthKey) - roleSum(expenses, recurring, monthKey, roleOf, "vat");
  return { gross, vat, vatSource: source, spent, balance: gross - vat - spent };
}

/** Hourly rates from work income only (every type except "inne"), counting
 * only entries that have hours:
 * - `beforeTax`: after VAT (the month's VAT as in monthVat — the VAT actually
 *   paid when recorded, spread over the invoices in proportion to their VAT),
 *   before ZUS and income tax;
 * - `takeHome`: after also subtracting the month's ZUS and income-tax expenses
 *   (categories with role "zus" / "income_tax"). */
export function monthHourlyRates(
  incomes: Income[],
  recurringIncomes: RecurringIncome[],
  expenses: Expense[],
  recurring: RecurringExpense[],
  monthKey: string,
  roleOf: RoleOf
) {
  const work = incomesForMonth(incomes, recurringIncomes, monthKey).filter((x) => x.type !== "inne" && x.hours > 0);
  const hours = work.reduce((s, x) => s + x.hours, 0);
  const { factor } = monthVat(incomes, recurringIncomes, expenses, recurring, monthKey, roleOf);
  const net = work.reduce((s, x) => s + netAfterVat(x, factor) * (Number(x.fx_rate) || 1), 0);
  const zus = roleSum(expenses, recurring, monthKey, roleOf, "zus");
  const tax = roleSum(expenses, recurring, monthKey, roleOf, "income_tax");
  return {
    hours,
    zus,
    tax,
    beforeTax: hours > 0 ? net / hours : 0,
    takeHome: hours > 0 ? (net - zus - tax) / hours : 0,
  };
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
  return initial + entries.reduce((sum, e) => sum + baseAmount(e), 0);
}

export function savingsForMonth(entries: SavingsEntry[], monthKey: string): number {
  return entries
    .filter((e) => e.date.slice(0, 7) === monthKey)
    .reduce((sum, e) => sum + baseAmount(e), 0);
}
