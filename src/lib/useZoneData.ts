"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { createClient } from "@/lib/supabase/client";
import { CategoryBudget, Expense, Income, RecurringExpense, RecurringIncome, RecurringTemplate, SavingsEntry } from "@/lib/types";
import { daysInMonth, isActiveInMonth, lastDayOfMonth, nextMonth, pad2 } from "@/lib/finance";

/** Months a template has occurrences in, up to `currentMonth`. */
function occurrenceMonths(t: RecurringTemplate, currentMonth: string): string[] {
  const months: string[] = [];
  for (let m = t.start_month, guard = 0; m <= currentMonth && guard < 240; m = nextMonth(m), guard++) {
    if (isActiveInMonth(t, m)) months.push(m);
  }
  return months;
}

const expenseDate = (r: RecurringExpense, m: string) => `${m}-${pad2(Math.min(r.day_of_month, daysInMonth(m)))}`;
const incomeDate = (_: RecurringIncome, m: string) => lastDayOfMonth(m);

// Client-side data layer for one zone. Fetches everything once on mount
// (sync is "poll at startup", per the agreed stack) and keeps local state in
// sync with Supabase through each mutation below. Every mutation updates
// local state immediately so the UI feels instant, then confirms against the
// database; on failure it reports via the thrown/returned error so the
// caller's undo affordance (the Toast "Cofnij" button) can revert cleanly.

export function useZoneData(zoneId: string | null, zoneCurrency = "PLN", currentMonth = "") {
  const supabase = createClient();
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
    ]).then(([incomesRes, expensesRes, recurringRes, savingsStateRes, savingsEntriesRes, budgetsRes, recurringIncomesRes]) => {
      if (cancelled) return;
      setRecurringIncomes((recurringIncomesRes.data as RecurringIncome[]) ?? []);
      setBudgets(((budgetsRes.data as CategoryBudget[]) ?? []).map((b) => ({ ...b, amount: Number(b.amount) })));
      setIncomes((incomesRes.data as Income[]) ?? []);
      setExpenses((expensesRes.data as Expense[]) ?? []);
      setRecurring((recurringRes.data as RecurringExpense[]) ?? []);
      setSavingsInitialState(savingsStateRes.data?.initial ?? 0);
      setSavingsEntries((savingsEntriesRes.data as SavingsEntry[]) ?? []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneId]);

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
  }, [recurring, recurringIncomes, zoneCurrency, currentMonth]);

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
    const { data, error } = await supabase
      .from("incomes")
      .insert({ ...income, zone_id: zoneId })
      .select()
      .single();
    if (!error && data) setIncomes((prev) => [...prev, data as Income]);
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
    const { data } = await supabase.from("incomes").insert({ id, ...rest }).select().single();
    if (data) setIncomes((prev) => [...prev, data as Income]);
  }

  async function updateIncome(id: string, patch: Partial<Omit<Income, "id" | "zone_id">>) {
    const before = incomes.find((x) => x.id === id);
    setIncomes((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from("incomes").update(patch).eq("id", id);
    if (error && before) setIncomes((prev) => prev.map((x) => (x.id === id ? before : x)));
    return error;
  }

  // ---------- expenses ----------
  async function addExpense(expense: Omit<Expense, "id" | "zone_id">) {
    if (!zoneId) return;
    const { data, error } = await supabase
      .from("expenses")
      .insert({ ...expense, zone_id: zoneId })
      .select()
      .single();
    if (!error && data) setExpenses((prev) => [...prev, data as Expense]);
    return error;
  }

  async function updateExpense(id: string, patch: Partial<Omit<Expense, "id" | "zone_id">>) {
    const before = expenses.find((x) => x.id === id);
    setExpenses((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from("expenses").update(patch).eq("id", id);
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
    const { data } = await supabase.from("expenses").insert({ id, ...rest }).select().single();
    if (data) setExpenses((prev) => [...prev, data as Expense]);
  }

  // ---------- recurring templates (expenses & incomes) ----------
  // Both tables share the same template semantics, so one set of operations
  // serves both; each instance is bound to its table and state.
  function recurringOps<T extends RecurringTemplate>(
    table: "recurring_expenses" | "recurring_incomes",
    items: T[],
    setItems: Dispatch<SetStateAction<T[]>>
  ) {
    type Fields = Omit<T, "id" | "zone_id" | "skip_months" | "created_at">;

    async function add(fields: Fields) {
      if (!zoneId) return;
      const { data, error } = await supabase
        .from(table)
        .insert({ ...fields, zone_id: zoneId, skip_months: [] })
        .select()
        .single();
      if (!error && data) setItems((prev) => [...prev, data as T]);
      return error;
    }

    async function update(id: string, patch: Partial<Fields>) {
      const before = items.find((r) => r.id === id);
      setItems((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
      const { error } = await supabase.from(table).update(patch as Record<string, unknown>).eq("id", id);
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
            const { data } = await supabase.from(table).insert(tpl).select().single();
            if (data) setItems((prev) => [...prev, data as T]);
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

  const recurringExpenseOps = recurringOps("recurring_expenses", recurring, setRecurring);
  const recurringIncomeOps = recurringOps("recurring_incomes", recurringIncomes, setRecurringIncomes);

  // ---------- savings ----------
  async function setSavingsInitial(value: number) {
    if (!zoneId) return;
    const before = savingsInitial;
    setSavingsInitialState(value);
    const { error } = await supabase.from("savings_state").upsert({ zone_id: zoneId, initial: value });
    if (error) setSavingsInitialState(before);
    return error;
  }

  async function addSavingsEntry(entry: Omit<SavingsEntry, "id" | "zone_id">) {
    if (!zoneId) return;
    const { data, error } = await supabase
      .from("savings_entries")
      .insert({ ...entry, zone_id: zoneId })
      .select()
      .single();
    if (!error && data) setSavingsEntries((prev) => [...prev, data as SavingsEntry]);
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
    const { data } = await supabase.from("savings_entries").insert({ id, ...rest }).select().single();
    if (data) setSavingsEntries((prev) => [...prev, data as SavingsEntry]);
  }

  async function updateSavingsEntry(id: string, patch: Partial<Omit<SavingsEntry, "id" | "zone_id">>) {
    const before = savingsEntries.find((x) => x.id === id);
    setSavingsEntries((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from("savings_entries").update(patch).eq("id", id);
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
      const { error } = await supabase
        .from("category_budgets")
        .upsert(keep.map(([category_id, amount]) => ({ zone_id: zoneId, category_id, amount })));
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
