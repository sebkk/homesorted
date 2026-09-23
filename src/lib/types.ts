// Core data model — mirrors the prototype's shape 1:1 so the finance logic
// (recurring skip/disable, totals, chart) ports over unchanged.

export type IncomeType = "b2b" | "uop" | "uz" | "uod" | "inne";

export interface Zone {
  id: string;
  user_id: string;
  name: string;
  pinned: boolean;
  color: number; // 1-8, indexes into the cat1..cat8 palette
  created_at: string;
}

export interface Income {
  id: string;
  zone_id: string;
  month: string; // "YYYY-MM"
  type: IncomeType;
  hours: number;
  amount: number;
  desc: string;
}

export interface Expense {
  id: string;
  zone_id: string;
  date: string; // "YYYY-MM-DD"
  category: string;
  desc: string;
  amount: number;
}

export interface RecurringExpense {
  id: string;
  zone_id: string;
  category: string;
  desc: string;
  amount: number;
  day_of_month: number;
  start_month: string; // "YYYY-MM"
  end_month: string | null; // forward-only cutoff — months >= end_month are excluded
  skip_months: string[]; // one-off exceptions
}

export interface SavingsEntry {
  id: string;
  zone_id: string;
  date: string;
  desc: string;
  amount: number; // negative = withdrawal
}

export interface SavingsState {
  initial: number;
  entries: SavingsEntry[];
}

// An expense occurrence generated from a recurring template for one month,
// shaped like a regular Expense so the UI can render both uniformly.
export interface RecurringOccurrence {
  id: string; // "rec_<templateId>_<month>"
  date: string;
  category: string;
  desc: string;
  amount: number;
  recurring: true;
  templateId: string;
  month: string;
}

export type AnyExpense = Expense | RecurringOccurrence;

export const CATEGORIES = [
  "ZUS",
  "Podatek",
  "VAT",
  "Mieszkanie/czynsz",
  "Rachunki (prąd, internet)",
  "Jedzenie",
  "Transport/paliwo",
  "Sprzęt/oprogramowanie",
  "Księgowość",
  "Ubezpieczenie",
  "Abonamenty",
  "Rozwój/szkolenia",
  "Zdrowie",
  "Rozrywka",
  "Inne",
] as const;

export const MONTHS = [
  "Styczeń",
  "Luty",
  "Marzec",
  "Kwiecień",
  "Maj",
  "Czerwiec",
  "Lipiec",
  "Sierpień",
  "Wrzesień",
  "Październik",
  "Listopad",
  "Grudzień",
];

export const INCOME_TYPE_LABELS: Record<IncomeType, string> = {
  b2b: "Faktura B2B",
  uop: "Umowa o pracę (UoP)",
  uz: "Umowa zlecenie (UZ)",
  uod: "Umowa o dzieło (UoD)",
  inne: "Inny przychód",
};
