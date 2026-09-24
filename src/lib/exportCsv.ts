import { allMonthsSorted, baseAmount, expensesForMonth, grossAmount, grossBase, incomesForMonth, type MonthPeriod } from "./finance";
import { Expense, Income, IncomeType, RecurringExpense, RecurringIncome, SavingsEntry } from "./types";

/** Translator for the "csv" messages namespace. */
type CsvT = (key: string, values?: Record<string, string>) => string;

// Formatted for Polish Excel regardless of UI language (the separator depends
// on the spreadsheet's regional settings, not on the app): ";" separator, "," decimal mark, UTF-8 BOM so
// diacritics survive a double-click open without the import wizard.

function textCell(v: string): string {
  // Neutralise spreadsheet formula injection from free-text fields.
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function amountCell(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

export function buildTransactionsCsv({
  incomes,
  recurringIncomes,
  expenses,
  recurring,
  savingsEntries,
  currentMonth,
  categoryName,
  incomeTypeLabel,
  zoneCurrency,
  period,
  t,
}: {
  incomes: Income[];
  recurringIncomes: RecurringIncome[];
  expenses: Expense[];
  recurring: RecurringExpense[];
  savingsEntries: SavingsEntry[];
  currentMonth: string;
  categoryName: (categoryId: string) => string;
  incomeTypeLabel: (type: IncomeType) => string;
  zoneCurrency: string;
  period: MonthPeriod;
  t: CsvT;
}): string {
  const months = allMonthsSorted(incomes, expenses, [...recurring, ...recurringIncomes], currentMonth, period);
  type Row = { date: string; type: string; category: string; desc: string; amount: number; gross?: number; original: number; currency: string; rate: number };
  const rows: Row[] = [
    ...months.flatMap((m) =>
      incomesForMonth(incomes, recurringIncomes, m).map((x) => ({
        date: x.month,
        type: "recurring" in x ? t("recurringIncome") : t("income"),
        category: incomeTypeLabel(x.type),
        desc: x.desc,
        amount: baseAmount(x),
        gross: grossBase(x),
        original: grossAmount(x),
        currency: x.currency,
        rate: x.fx_rate,
      }))
    ),
    ...months.flatMap((m) =>
      expensesForMonth(expenses, recurring, m, period).map((x) => ({
        date: x.date,
        type: "recurring" in x ? t("recurringExpense") : t("expense"),
        category: categoryName(x.category_id),
        desc: x.desc,
        amount: -baseAmount(x),
        original: -x.amount,
        currency: x.currency,
        rate: x.fx_rate,
      }))
    ),
    ...savingsEntries.map((x) => ({
      date: x.date,
      type: x.amount >= 0 ? t("deposit") : t("withdrawal"),
      category: "",
      desc: x.desc,
      amount: baseAmount(x),
      original: x.amount,
      currency: x.currency,
      rate: x.fx_rate,
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const lines = [
    [
      t("date"),
      t("type"),
      t("category"),
      t("desc"),
      t("net", { currency: zoneCurrency }),
      t("gross", { currency: zoneCurrency }),
      t("original"),
      t("currency"),
      t("rate"),
    ]
      .map(textCell)
      .join(";"),
    ...rows.map((r) =>
      [
        r.date,
        textCell(r.type),
        textCell(r.category),
        textCell(r.desc),
        amountCell(r.amount),
        amountCell(r.gross ?? r.amount),
        amountCell(r.original),
        r.currency,
        String(r.rate).replace(".", ","),
      ].join(";")
    ),
  ];
  return "﻿" + lines.join("\r\n");
}

export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
