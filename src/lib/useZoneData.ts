"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { createClient } from "@/lib/supabase/client";
import { CategoryBudget, Expense, Income, RecurringExpense, RecurringIncome, RecurringTemplate, SavingsEntry } from "@/lib/types";
import { CALENDAR_MONTH, isActiveInMonth, lastDayOfMonth, nextMonth, periodDay, type MonthPeriod } from "@/lib/finance";
import { decryptNumber, decryptText, encryptNumber, encryptText, isEncrypted } from "@/lib/crypto";

/** Months a template has occurrences in, up to `currentMonth`. */
function occurrenceMonths(t: RecurringTemplate, currentMonth: string): string[] {
  const months: string[] = [];
  for (let m = t.start_month, guard = 0; m <= currentMonth && guard < 240; m = nextMonth(m), guard++) {
    if (isActiveInMonth(t, m)) months.push(m);
  }
  return months;
}

const incomeDate = (_: RecurringIncome, m: string) => lastDayOfMonth(m);

// ---------- encryption codec ----------
// `amount`/`hours`/"desc" columns hold either a plain value (accounts that
// haven't enabled encryption yet) or a ciphertext blob (see src/lib/crypto.ts)
// — isEncrypted() tells the two apart per field, so both states can coexist
// row by row during the one-time migration. `dek` is null whenever
// encryption isn't enabled for this account; in that case values pass
// through unchanged, exactly like before encryption existed.

interface AmountDesc {
  amount: number;
  desc: string;
}
interface AmountHoursDesc extends AmountDesc {
  hours: number;
}

async function decodeAmount(dek: CryptoKey | null, raw: unknown): Promise<number> {
  const s = String(raw ?? "0");
  if (!isEncrypted(s)) return Number(s);
  if (!dek) return NaN; // shouldn't happen: the encryption gate blocks this state
  try {
    return await decryptNumber(dek, s);
  } catch {
    return NaN;
  }
}

async function encodeAmount(dek: CryptoKey | null, n: number): Promise<string> {
  return dek ? encryptNumber(dek, n) : String(n);
}

async function decodeText(dek: CryptoKey | null, raw: unknown): Promise<string> {
  const s = String(raw ?? "");
  if (!isEncrypted(s)) return s;
  if (!dek) return "";
  try {
    return await decryptText(dek, s);
  } catch {
    return "";
  }
}

async function encodeText(dek: CryptoKey | null, s: string): Promise<string> {
  return dek ? encryptText(dek, s) : s;
}

async function decodeAmountDesc<T extends AmountDesc>(dek: CryptoKey | null, row: unknown): Promise<T> {
  const r = row as T;
  const [amount, desc] = await Promise.all([decodeAmount(dek, r.amount), decodeText(dek, r.desc)]);
  return { ...r, amount, desc };
}

async function encodeAmountDesc(dek: CryptoKey | null, fields: Record<string, unknown>): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { ...fields };
  if (fields.amount !== undefined) out.amount = await encodeAmount(dek, Number(fields.amount));
  if (fields.desc !== undefined) out.desc = await encodeText(dek, String(fields.desc));
  return out;
}

async function decodeAmountHoursDesc<T extends AmountHoursDesc>(dek: CryptoKey | null, row: unknown): Promise<T> {
  const r = row as T;
  const [amount, hours, desc] = await Promise.all([decodeAmount(dek, r.amount), decodeAmount(dek, r.hours), decodeText(dek, r.desc)]);
  return { ...r, amount, hours, desc };
}

async function encodeAmountHoursDesc(dek: CryptoKey | null, fields: Record<string, unknown>): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { ...fields };
  if (fields.amount !== undefined) out.amount = await encodeAmount(dek, Number(fields.amount));
  if (fields.hours !== undefined) out.hours = await encodeAmount(dek, Number(fields.hours));
  if (fields.desc !== undefined) out.desc = await encodeText(dek, String(fields.desc));
  return out;
}

// Client-side data layer for one zone. Fetches everything once on mount
// (sync is "poll at startup", per the agreed stack) and keeps local state in
// sync with Supabase through each mutation below. Every mutation updates
// local state immediately so the UI feels instant, then confirms against the
// database; on failure it reports via the thrown/returned error so the
// caller's undo affordance (the Toast "Cofnij" button) can revert cleanly.
//
// `dek` is the user's data key (see EncryptionContext) — present only while
// encryption is enabled AND unlocked for this session. In-memory state here
// always holds plain, decrypted values; only the wire payloads sent to/read
// from Supabase pass through the codec above.

export function useZoneData(
  zoneId: string | null,
  zoneCurrency = "PLN",
  currentMonth = "",
  dek: CryptoKey | null = null,
  period: MonthPeriod = CALENDAR_MONTH
) {
  const supabase = createClient();
  // Date of a recurring expense's occurrence in a month — same rule as
  // recurringForMonth, so its NBP rate is fetched for the right day.
  const expenseDate = (r: RecurringExpense, m: string) => periodDay(r.day_of_month, m, period);
  const [loading, setLoading] = useState(true);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurring, setRecurring] = useState<RecurringExpense[]>([]);
  const [recurringIncomes, setRecurringIncomes] = useState<RecurringIncome[]>([]);
  const [savingsInitial, setSavingsInitialState] = useState(0);
  const [savingsEntries, setSavingsEntries] = useState<SavingsEntry[]>([]);
  const [budgets, setBudgets] = useState<CategoryBudget[]>([]);
  // NBP rates for each occurrence of foreign-currency templates, keyed
  // "CUR@date@ZONE"; NaN marks "NBP has no rate" so it isn't refetched.
  const [fxRates, setFxRates] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!zoneId) return;
    let cancelled = false;
    Promise.all([
      supabase.from("incomes").select("*").eq("zone_id", zoneId),
      supabase.from("expenses").select("*").eq("zone_id", zoneId),
      supabase.from("recurring_expenses").select("*").eq("zone_id", zoneId),
      supabase.from("savings_state").select("*").eq("zone_id", zoneId).maybeSingle(),
      supabase.from("savings_entries").select("*").eq("zone_id", zoneId),
      supabase.from("category_budgets").select("*").eq("zone_id", zoneId),
      supabase.from("recurring_incomes").select("*").eq("zone_id", zoneId),
    ]).then(async ([incomesRes, expensesRes, recurringRes, savingsStateRes, savingsEntriesRes, budgetsRes, recurringIncomesRes]) => {
      if (cancelled) return;
      const [decodedIncomes, decodedExpenses, decodedRecurring, decodedRecurringIncomes, decodedSavingsEntries, decodedBudgets, decodedInitial] =
        await Promise.all([
          Promise.all(((incomesRes.data as unknown[]) ?? []).map((r) => decodeAmountHoursDesc<Income>(dek, r))),
          Promise.all(((expensesRes.data as unknown[]) ?? []).map((r) => decodeAmountDesc<Expense>(dek, r))),
          Promise.all(((recurringRes.data as unknown[]) ?? []).map((r) => decodeAmountDesc<RecurringExpense>(dek, r))),
          Promise.all(((recurringIncomesRes.data as unknown[]) ?? []).map((r) => decodeAmountHoursDesc<RecurringIncome>(dek, r))),
          Promise.all(((savingsEntriesRes.data as unknown[]) ?? []).map((r) => decodeAmountDesc<SavingsEntry>(dek, r))),
          Promise.all(((budgetsRes.data as CategoryBudget[]) ?? []).map(async (b) => ({ ...b, amount: await decodeAmount(dek, b.amount) }))),
          decodeAmount(dek, savingsStateRes.data?.initial ?? "0"),
        ]);
      if (cancelled) return;
      setRecurringIncomes(decodedRecurringIncomes);
      setBudgets(decodedBudgets);
      setIncomes(decodedIncomes);
      setExpenses(decodedExpenses);
      setRecurring(decodedRecurring);
      setSavingsInitialState(decodedInitial);
      setSavingsEntries(decodedSavingsEntries);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneId, dek]);

  // ---------- per-month FX for foreign-currency templates ----------
  const fxKey = (currency: string, date: string) => `${currency}@${date}@${zoneCurrency}`;
  const neededFx = useMemo(() => {
    const items = new Map<string, { currency: string; date: string }>();
    const collect = <T extends RecurringTemplate & { currency: string }>(list: T[], dateOf: (r: T, m: string) => string) => {
      for (const r of list) {
        if (r.currency === zoneCurrency) continue;
        for (const m of occurrenceMonths(r, currentMonth)) {
          const date = dateOf(r, m);
          items.set(fxKey(r.currency, date), { currency: r.currency, date });
        }
      }
    };
    collect(recurring, expenseDate);
    collect(recurringIncomes, incomeDate);
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recurring, recurringIncomes, zoneCurrency, currentMonth, period.startDay, period.label]);

  const missingFx = [...neededFx.entries()].filter(([k]) => !(k in fxRates));
  const missingKey = missingFx.map(([k]) => k).join("|");

  useEffect(() => {
    if (!missingKey) return;
    let cancelled = false;
    const items = missingFx.map(([, v]) => v);
    fetch("/api/fx", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: zoneCurrency, items }) })
      .then((r) => r.json())
      .then((json: { rates?: Record<string, { rate: number } | null> }) => {
        if (cancelled) return;
        const next: Record<string, number> = {};
        for (const { currency, date } of items) next[fxKey(currency, date)] = json.rates?.[`${currency}@${date}`]?.rate ?? NaN;
        setFxRates((prev) => ({ ...prev, ...next }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingKey, zoneCurrency]);

  function withMonthlyFx<T extends RecurringTemplate & { currency: string; fx_by_month?: Record<string, number> }>(
    list: T[],
    dateOf: (r: T, m: string) => string
  ): T[] {
    return list.map((r) => {
      if (r.currency === zoneCurrency) return r;
      const byMonth: Record<string, number> = {};
      for (const m of occurrenceMonths(r, currentMonth)) {
        const rate = fxRates[fxKey(r.currency, dateOf(r, m))];
        if (Number.isFinite(rate)) byMonth[m] = rate;
      }
      return { ...r, fx_by_month: byMonth };
    });
  }

  // ---------- incomes ----------
  async function addIncome(income: Omit<Income, "id" | "zone_id">) {
    if (!zoneId) return;
    const payload = await encodeAmountHoursDesc(dek, income);
    const { data, error } = await supabase
      .from("incomes")
      .insert({ ...payload, zone_id: zoneId })
      .select()
      .single();
    if (!error && data) {
      const decoded = await decodeAmountHoursDesc<Income>(dek, data);
      setIncomes((prev) => [...prev, decoded]);
    }
    return error;
  }

  async function deleteIncome(id: string) {
    const removed = incomes.find((x) => x.id === id) ?? null;
    setIncomes((prev) => prev.filter((x) => x.id !== id));
    await supabase.from("incomes").delete().eq("id", id);
    return removed;
  }

  async function restoreIncome(income: Income) {
    const { id, ...rest } = income;
    const payload = await encodeAmountHoursDesc(dek, rest);
    const { data } = await supabase
      .from("incomes")
      .insert({ id, ...payload })
      .select()
      .single();
    if (data) {
      const decoded = await decodeAmountHoursDesc<Income>(dek, data);
      setIncomes((prev) => [...prev, decoded]);
    }
  }

  async function updateIncome(id: string, patch: Partial<Omit<Income, "id" | "zone_id">>) {
    const before = incomes.find((x) => x.id === id);
    setIncomes((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const payload = await encodeAmountHoursDesc(dek, patch);
    const { error } = await supabase.from("incomes").update(payload).eq("id", id);
    if (error && before) setIncomes((prev) => prev.map((x) => (x.id === id ? before : x)));
    return error;
  }

  // ---------- expenses ----------
  async function addExpense(expense: Omit<Expense, "id" | "zone_id">) {
    if (!zoneId) return;
    const payload = await encodeAmountDesc(dek, expense);
    const { data, error } = await supabase
      .from("expenses")
      .insert({ ...payload, zone_id: zoneId })
      .select()
      .single();
    if (!error && data) {
      const decoded = await decodeAmountDesc<Expense>(dek, data);
      setExpenses((prev) => [...prev, decoded]);
    }
    return error;
  }

  async function updateExpense(id: string, patch: Partial<Omit<Expense, "id" | "zone_id">>) {
    const before = expenses.find((x) => x.id === id);
    setExpenses((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const payload = await encodeAmountDesc(dek, patch);
    const { error } = await supabase.from("expenses").update(payload).eq("id", id);
    if (error && before) setExpenses((prev) => prev.map((x) => (x.id === id ? before : x)));
    return error;
  }

  async function deleteExpense(id: string) {
    const removed = expenses.find((x) => x.id === id) ?? null;
    setExpenses((prev) => prev.filter((x) => x.id !== id));
    await supabase.from("expenses").delete().eq("id", id);
    return removed;
  }

  async function restoreExpense(expense: Expense) {
    const { id, ...rest } = expense;
    const payload = await encodeAmountDesc(dek, rest);
    const { data } = await supabase
      .from("expenses")
      .insert({ id, ...payload })
      .select()
      .single();
    if (data) {
      const decoded = await decodeAmountDesc<Expense>(dek, data);
      setExpenses((prev) => [...prev, decoded]);
    }
  }

  // ---------- recurring templates (expenses & incomes) ----------
  // Both tables share the same template semantics, so one set of operations
  // serves both; each instance is bound to its table, state, and codec
  // (expenses encode amount+desc, incomes also encode hours).
  function recurringOps<T extends RecurringTemplate & AmountDesc>(
    table: "recurring_expenses" | "recurring_incomes",
    items: T[],
    setItems: Dispatch<SetStateAction<T[]>>,
    encodeFields: (dek: CryptoKey | null, fields: Record<string, unknown>) => Promise<Record<string, unknown>>,
    decodeItem: (dek: CryptoKey | null, row: unknown) => Promise<T>
  ) {
    type Fields = Omit<T, "id" | "zone_id" | "skip_months" | "created_at">;

    async function add(fields: Fields) {
      if (!zoneId) return;
      const payload = await encodeFields(dek, fields as Record<string, unknown>);
      const { data, error } = await supabase
        .from(table)
        .insert({ ...payload, zone_id: zoneId, skip_months: [] })
        .select()
        .single();
      if (!error && data) {
        const decoded = await decodeItem(dek, data);
        setItems((prev) => [...prev, decoded]);
      }
      return error;
    }

    async function update(id: string, patch: Partial<Fields>) {
      const before = items.find((r) => r.id === id);
      setItems((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
      const payload = await encodeFields(dek, patch as Record<string, unknown>);
      const { error } = await supabase.from(table).update(payload).eq("id", id);
      if (error && before) setItems((prev) => prev.map((r) => (r.id === id ? before : r)));
      return error;
    }

    async function setSkipped(id: string, monthKey: string, skipped: boolean) {
      const tpl = items.find((r) => r.id === id);
      if (!tpl) return;
      const has = tpl.skip_months.includes(monthKey);
      const next = skipped ? (has ? tpl.skip_months : [...tpl.skip_months, monthKey]) : tpl.skip_months.filter((m) => m !== monthKey);
      setItems((prev) => prev.map((r) => (r.id === id ? { ...r, skip_months: next } : r)));
      await supabase.from(table).update({ skip_months: next }).eq("id", id);
    }

    /** Forward-only cutoff from `monthKey`; earlier months keep their totals.
     * If the template hadn't started before `monthKey` there's nothing to keep,
     * so it's deleted outright instead of leaving a template that applies to
     * zero months. Returns an undo for either case. */
    async function disableFrom(id: string, monthKey: string): Promise<{ deleted: boolean; undo: () => Promise<void> } | null> {
      const tpl = items.find((r) => r.id === id);
      if (!tpl) return null;

      if (monthKey <= tpl.start_month) {
        setItems((prev) => prev.filter((r) => r.id !== id));
        await supabase.from(table).delete().eq("id", id);
        return {
          deleted: true,
          undo: async () => {
            const payload = await encodeFields(dek, tpl as unknown as Record<string, unknown>);
            const { data } = await supabase
              .from(table)
              .insert({ ...tpl, ...payload })
              .select()
              .single();
            if (data) {
              const decoded = await decodeItem(dek, data);
              setItems((prev) => [...prev, decoded]);
            }
          },
        };
      }

      const prevEnd = tpl.end_month;
      const nextEnd = !prevEnd || monthKey < prevEnd ? monthKey : prevEnd;
      setItems((prev) => prev.map((r) => (r.id === id ? { ...r, end_month: nextEnd } : r)));
      await supabase.from(table).update({ end_month: nextEnd }).eq("id", id);
      return {
        deleted: false,
        undo: async () => {
          setItems((prev) => prev.map((r) => (r.id === id ? { ...r, end_month: prevEnd } : r)));
          await supabase.from(table).update({ end_month: prevEnd }).eq("id", id);
        },
      };
    }

    return {
      add,
      update,
      skip: (id: string, monthKey: string) => setSkipped(id, monthKey, true),
      undoSkip: (id: string, monthKey: string) => setSkipped(id, monthKey, false),
      disableFrom,
    };
  }

  const recurringExpenseOps = recurringOps<RecurringExpense>(
    "recurring_expenses",
    recurring,
    setRecurring,
    (d, f) => encodeAmountDesc(d, f),
    (d, r) => decodeAmountDesc<RecurringExpense>(d, r)
  );
  const recurringIncomeOps = recurringOps<RecurringIncome>(
    "recurring_incomes",
    recurringIncomes,
    setRecurringIncomes,
    (d, f) => encodeAmountHoursDesc(d, f),
    (d, r) => decodeAmountHoursDesc<RecurringIncome>(d, r)
  );

  // ---------- savings ----------
  async function setSavingsInitial(value: number) {
    if (!zoneId) return;
    const before = savingsInitial;
    setSavingsInitialState(value);
    const encoded = await encodeAmount(dek, value);
    const { error } = await supabase.from("savings_state").upsert({ zone_id: zoneId, initial: encoded });
    if (error) setSavingsInitialState(before);
    return error;
  }

  async function addSavingsEntry(entry: Omit<SavingsEntry, "id" | "zone_id">) {
    if (!zoneId) return;
    const payload = await encodeAmountDesc(dek, entry);
    const { data, error } = await supabase
      .from("savings_entries")
      .insert({ ...payload, zone_id: zoneId })
      .select()
      .single();
    if (!error && data) {
      const decoded = await decodeAmountDesc<SavingsEntry>(dek, data);
      setSavingsEntries((prev) => [...prev, decoded]);
    }
    return error;
  }

  async function deleteSavingsEntry(id: string) {
    const removed = savingsEntries.find((x) => x.id === id) ?? null;
    setSavingsEntries((prev) => prev.filter((x) => x.id !== id));
    await supabase.from("savings_entries").delete().eq("id", id);
    return removed;
  }

  async function restoreSavingsEntry(entry: SavingsEntry) {
    const { id, ...rest } = entry;
    const payload = await encodeAmountDesc(dek, rest);
    const { data } = await supabase
      .from("savings_entries")
      .insert({ id, ...payload })
      .select()
      .single();
    if (data) {
      const decoded = await decodeAmountDesc<SavingsEntry>(dek, data);
      setSavingsEntries((prev) => [...prev, decoded]);
    }
  }

  async function updateSavingsEntry(id: string, patch: Partial<Omit<SavingsEntry, "id" | "zone_id">>) {
    const before = savingsEntries.find((x) => x.id === id);
    setSavingsEntries((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const payload = await encodeAmountDesc(dek, patch);
    const { error } = await supabase.from("savings_entries").update(payload).eq("id", id);
    if (error && before) setSavingsEntries((prev) => prev.map((x) => (x.id === id ? before : x)));
    return error;
  }

  // ---------- budgets ----------
  /** Replaces the zone's budgets: categories mapped to a positive amount are
   * upserted, everything else (cleared inputs) is removed. */
  async function saveBudgets(limits: Record<string, number>) {
    if (!zoneId) return;
    const keep = Object.entries(limits).filter(([, amount]) => amount > 0);
    const drop = budgets.map((b) => b.category_id).filter((c) => !keep.some(([k]) => k === c));

    if (keep.length > 0) {
      const rows = await Promise.all(
        keep.map(async ([category_id, amount]) => ({ zone_id: zoneId, category_id, amount: await encodeAmount(dek, amount) }))
      );
      const { error } = await supabase.from("category_budgets").upsert(rows);
      if (error) return error;
    }
    if (drop.length > 0) {
      const { error } = await supabase.from("category_budgets").delete().eq("zone_id", zoneId).in("category_id", drop);
      if (error) return error;
    }
    setBudgets(keep.map(([category_id, amount]) => ({ zone_id: zoneId, category_id, amount })));
    return null;
  }

  return {
    loading,
    /** The zone's month definition; pass it to the month helpers in finance.ts. */
    period,
    budgets,
    saveBudgets,
    incomes,
    expenses,
    recurring: withMonthlyFx(recurring, expenseDate),
    savingsInitial,
    savingsEntries,
    addIncome,
    updateIncome,
    deleteIncome,
    restoreIncome,
    addExpense,
    updateExpense,
    deleteExpense,
    restoreExpense,
    recurringIncomes: withMonthlyFx(recurringIncomes, incomeDate),
    recurringExpenseOps,
    recurringIncomeOps,
    setSavingsInitial,
    addSavingsEntry,
    updateSavingsEntry,
    deleteSavingsEntry,
    restoreSavingsEntry,
  };
}
