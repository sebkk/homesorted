import { allMonthsSorted, expensesForMonth, incomesForMonth } from "./finance";
import { Expense, Income, INCOME_TYPE_LABELS, RecurringExpense, RecurringIncome, SavingsEntry } from "./types";

// Formatted for Polish Excel: ";" separator, "," decimal mark, UTF-8 BOM so
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
}: {
  incomes: Income[];
  recurringIncomes: RecurringIncome[];
  expenses: Expense[];
  recurring: RecurringExpense[];
  savingsEntries: SavingsEntry[];
  currentMonth: string;
}): string {
  const months = allMonthsSorted(incomes, expenses, [...recurring, ...recurringIncomes], currentMonth);
  const rows: { date: string; type: string; category: string; desc: string; amount: number }[] = [
    ...months.flatMap((m) =>
      incomesForMonth(incomes, recurringIncomes, m).map((x) => ({
        date: x.month,
        type: "recurring" in x ? "Zarobek stały" : "Zarobek",
        category: INCOME_TYPE_LABELS[x.type],
        desc: x.desc,
        amount: x.amount,
      }))
    ),
    ...months.flatMap((m) =>
      expensesForMonth(expenses, recurring, m).map((x) => ({
        date: x.date,
        type: "recurring" in x ? "Wydatek stały" : "Wydatek",
        category: x.category,
        desc: x.desc,
        amount: -x.amount,
      }))
    ),
    ...savingsEntries.map((x) => ({
      date: x.date,
      type: x.amount >= 0 ? "Oszczędności — wpłata" : "Oszczędności — wypłata",
      category: "",
      desc: x.desc,
      amount: x.amount,
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const lines = [
    ["Data", "Typ", "Kategoria", "Opis", "Kwota (zł)"].join(";"),
    ...rows.map((r) => [r.date, textCell(r.type), textCell(r.category), textCell(r.desc), amountCell(r.amount)].join(";")),
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
