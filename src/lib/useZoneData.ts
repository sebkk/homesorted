"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Expense, Income, RecurringExpense, SavingsEntry } from "@/lib/types";

// Client-side data layer for one zone. Fetches everything once on mount
// (sync is "poll at startup", per the agreed stack) and keeps local state in
// sync with Supabase through each mutation below. Every mutation updates
// local state immediately so the UI feels instant, then confirms against the
// database; on failure it reports via the thrown/returned error so the
// caller's undo affordance (the Toast "Cofnij" button) can revert cleanly.

export function useZoneData(zoneId: string | null) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurring, setRecurring] = useState<RecurringExpense[]>([]);
  const [savingsInitial, setSavingsInitialState] = useState(0);
  const [savingsEntries, setSavingsEntries] = useState<SavingsEntry[]>([]);

  const reload = useCallback(async () => {
    if (!zoneId) return;
    setLoading(true);
    const [incomesRes, expensesRes, recurringRes, savingsStateRes, savingsEntriesRes] = await Promise.all([
      supabase.from("incomes").select("*").eq("zone_id", zoneId),
      supabase.from("expenses").select("*").eq("zone_id", zoneId),
      supabase.from("recurring_expenses").select("*").eq("zone_id", zoneId),
      supabase.from("savings_state").select("*").eq("zone_id", zoneId).maybeSingle(),
      supabase.from("savings_entries").select("*").eq("zone_id", zoneId),
    ]);
    setIncomes((incomesRes.data as Income[]) ?? []);
    setExpenses((expensesRes.data as Expense[]) ?? []);
    setRecurring((recurringRes.data as RecurringExpense[]) ?? []);
    setSavingsInitialState(savingsStateRes.data?.initial ?? 0);
    setSavingsEntries((savingsEntriesRes.data as SavingsEntry[]) ?? []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneId]);

  useEffect(() => {
    reload();
  }, [reload]);

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

  // ---------- recurring expenses ----------
  async function addRecurring(rec: Omit<RecurringExpense, "id" | "zone_id" | "skip_months" | "end_month">) {
    if (!zoneId) return;
    const { data, error } = await supabase
      .from("recurring_expenses")
      .insert({ ...rec, zone_id: zoneId, skip_months: [], end_month: null })
      .select()
      .single();
    if (!error && data) setRecurring((prev) => [...prev, data as RecurringExpense]);
    return error;
  }

  /** One-off exception: this single month is skipped, the template stays active. */
  async function skipRecurringMonth(templateId: string, monthKey: string) {
    const tpl = recurring.find((r) => r.id === templateId);
    if (!tpl) return;
    const nextSkip = tpl.skip_months.includes(monthKey) ? tpl.skip_months : [...tpl.skip_months, monthKey];
    setRecurring((prev) => prev.map((r) => (r.id === templateId ? { ...r, skip_months: nextSkip } : r)));
    await supabase.from("recurring_expenses").update({ skip_months: nextSkip }).eq("id", templateId);
  }

  async function undoSkipRecurringMonth(templateId: string, monthKey: string) {
    const tpl = recurring.find((r) => r.id === templateId);
    if (!tpl) return;
    const nextSkip = tpl.skip_months.filter((m) => m !== monthKey);
    setRecurring((prev) => prev.map((r) => (r.id === templateId ? { ...r, skip_months: nextSkip } : r)));
    await supabase.from("recurring_expenses").update({ skip_months: nextSkip }).eq("id", templateId);
  }

  /** Forward-only cutoff: months >= monthKey stop generating occurrences;
   * earlier months (and their historical totals) are untouched. */
  async function disableRecurringFrom(templateId: string, monthKey: string) {
    const tpl = recurring.find((r) => r.id === templateId);
    if (!tpl) return null;
    const prevEnd = tpl.end_month;
    const nextEnd = !prevEnd || monthKey < prevEnd ? monthKey : prevEnd;
    setRecurring((prev) => prev.map((r) => (r.id === templateId ? { ...r, end_month: nextEnd } : r)));
    await supabase.from("recurring_expenses").update({ end_month: nextEnd }).eq("id", templateId);
    return prevEnd;
  }

  async function restoreRecurringEnd(templateId: string, prevEnd: string | null) {
    setRecurring((prev) => prev.map((r) => (r.id === templateId ? { ...r, end_month: prevEnd } : r)));
    await supabase.from("recurring_expenses").update({ end_month: prevEnd }).eq("id", templateId);
  }

  // ---------- savings ----------
  async function setSavingsInitial(value: number) {
    if (!zoneId) return;
    setSavingsInitialState(value);
    await supabase.from("savings_state").upsert({ zone_id: zoneId, initial: value });
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

  return {
    loading,
    incomes,
    expenses,
    recurring,
    savingsInitial,
    savingsEntries,
    reload,
    addIncome,
    deleteIncome,
    restoreIncome,
    addExpense,
    deleteExpense,
    restoreExpense,
    addRecurring,
    skipRecurringMonth,
    undoSkipRecurringMonth,
    disableRecurringFrom,
    restoreRecurringEnd,
    setSavingsInitial,
    addSavingsEntry,
    deleteSavingsEntry,
    restoreSavingsEntry,
  };
}
