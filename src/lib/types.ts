// Core data model — mirrors the prototype's shape 1:1 so the finance logic
// (recurring skip/disable, totals, chart) ports over unchanged.

export type IncomeType = "b2b" | "uop" | "uz" | "uod" | "inne";

export interface Zone {
  id: string;
  user_id: string;
  name: string;
  pinned: boolean;
  color: number; // 1-8, indexes into the cat1..cat8 palette
  currency: string; // default currency: every sum in the zone is shown in it
  month_start_day: number; // 1-28; 1 = calendar months (see MonthPeriod)
  month_label: "start" | "end";
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
  icon: string | null; // overrides INCOME_TYPE_ICONS[type] when set
  vat_rate: number; // amount is net; gross = amount * (1 + vat_rate)
  invoice_date: string; // "YYYY-MM-DD", drives the NBP rate date
  currency: string; // ISO 4217 code of `amount`
  fx_rate: number; // amount * fx_rate = value in the zone's currency (NBP, see /api/fx)
  fx_date: string | null; // effective date of the NBP table used
  fx_table: string | null; // NBP table number(s), for reference
}

export interface Expense {
  id: string;
  zone_id: string;
  date: string; // "YYYY-MM-DD"
  category_id: string;
  desc: string;
  amount: number;
  icon: string | null; // overrides the category's default icon when set
  currency: string; // ISO 4217 code of `amount`
  fx_rate: number; // amount * fx_rate = value in the zone's currency (NBP, see /api/fx)
  fx_date: string | null; // effective date of the NBP table used
  fx_table: string | null; // NBP table number(s), for reference
}

export interface RecurringExpense {
  id: string;
  zone_id: string;
  category_id: string;
  desc: string;
  amount: number;
  day_of_month: number;
  start_month: string; // "YYYY-MM"
  end_month: string | null; // forward-only cutoff — months >= end_month are excluded
  skip_months: string[]; // one-off exceptions
  icon: string | null; // overrides the category's default icon when set
  created_at: string;
  currency: string; // ISO 4217 code of `amount`
  fx_rate: number; // amount * fx_rate = value in the zone's currency (NBP, see /api/fx)
  fx_date: string | null; // effective date of the NBP table used
  fx_table: string | null; // NBP table number(s), for reference
  /** Client-only: NBP rate per occurrence month (foreign currency templates). */
  fx_by_month?: Record<string, number>;
}

export interface SavingsEntry {
  id: string;
  zone_id: string;
  date: string;
  desc: string;
  amount: number; // negative = withdrawal
  currency: string; // ISO 4217 code of `amount`
  fx_rate: number; // amount * fx_rate = value in the zone's currency (NBP, see /api/fx)
  fx_date: string | null; // effective date of the NBP table used
  fx_table: string | null; // NBP table number(s), for reference
}

export interface RecurringIncome {
  id: string;
  zone_id: string;
  type: IncomeType;
  hours: number;
  amount: number;
  desc: string;
  icon: string | null;
  vat_rate: number; // amount is net
  start_month: string; // "YYYY-MM"
  end_month: string | null; // exclusive, forward-only cutoff
  skip_months: string[];
  created_at: string;
  currency: string; // ISO 4217 code of `amount`
  fx_rate: number; // amount * fx_rate = value in the zone's currency (NBP, see /api/fx)
  fx_date: string | null; // effective date of the NBP table used
  fx_table: string | null; // NBP table number(s), for reference
  fx_by_month?: Record<string, number>;
}

/** Special meaning of a category, used by calculations (never matched by name). */
export type CategoryRole = "zus" | "income_tax" | "vat";

export interface Category {
  id: string;
  key: string; // stable identifier, also the translation key
  name: string; // default (Polish) label, fallback when no translation exists
  icon: string;
  role: CategoryRole | null;
  sort_order: number;
}

/** Fields shared by recurring expense and income templates. */
export interface RecurringTemplate {
  id: string;
  zone_id: string;
  start_month: string;
  end_month: string | null;
  skip_months: string[];
  created_at: string;
}

export interface CategoryBudget {
  zone_id: string;
  category_id: string;
  amount: number; // monthly limit, applies to every month
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
  category_id: string;
  desc: string;
  amount: number;
  icon: string | null;
  currency: string;
  fx_rate: number;
  recurring: true;
  templateId: string;
  month: string;
}

export type AnyExpense = Expense | RecurringOccurrence;

// A recurring income template expanded for one month, shaped like an Income.
export interface RecurringIncomeOccurrence {
  id: string; // "reci_<templateId>_<month>"
  month: string;
  type: IncomeType;
  hours: number;
  amount: number;
  desc: string;
  icon: string | null;
  vat_rate: number;
  currency: string;
  fx_rate: number;
  recurring: true;
  templateId: string;
}

export const VAT_RATE = 0.23;

/** Longest zone name accepted (UI validation and the zone server actions). */
export const MAX_ZONE_NAME = 50;

/** Zone colors are 1..ZONE_COLORS, indexing the cat1..cat8 palette. */
export const ZONE_COLORS = 8;
export const zoneColorVar = (color: number) => `var(--cat${((color - 1) % ZONE_COLORS) + 1})`;

export type AnyIncome = Income | RecurringIncomeOccurrence;

/** Display order of income types; labels live in messages ("incomeTypes"). */
export const INCOME_TYPES: IncomeType[] = ["b2b", "uop", "uz", "uod", "inne"];

export const INCOME_TYPE_ICONS: Record<IncomeType, string> = {
  b2b: "🧾",
  uop: "💼",
  uz: "📝",
  uod: "🛠️",
  inne: "✨",
};
