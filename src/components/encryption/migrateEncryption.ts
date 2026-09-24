import { createClient } from "@/lib/supabase/client";
import { encryptNumber, encryptText } from "@/lib/crypto";

type Supabase = ReturnType<typeof createClient>;

/** Matches ciphertext (see isEncrypted in src/lib/crypto.ts); used negated to
 * select only rows that still hold plain values. */
const PLAINTEXT_FILTER = "v1:%";

/**
 * Encrypts every still-plaintext sensitive field (amounts, hours,
 * descriptions) across every zone the user owns. Runs right after the user
 * sets an encryption password (see EncryptionSetup.tsx) and again after each
 * unlock (see EncryptionContext) to finish a run that was interrupted — e.g.
 * the tab was closed mid-way. Only rows whose amount isn't ciphertext yet are
 * fetched (every update writes all of a row's fields at once), so re-runs are
 * safe and, once everything is encrypted, cost one empty query per table.
 */
export async function migrateAllZonesToEncryption(
  supabase: Supabase,
  dek: CryptoKey,
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const { data: zones } = await supabase.from("zones").select("id");
  const zoneIds = (zones ?? []).map((z: { id: string }) => z.id);

  // Each update re-checks that the row is still plaintext, so a row the user
  // edited (and thereby encrypted) since it was read here is never overwritten.
  const jobs: (() => Promise<void>)[] = [];

  for (const zoneId of zoneIds) {
    const [incomes, expenses, recurringExpenses, recurringIncomes, savingsEntries, savingsState, budgets] = await Promise.all([
      supabase.from("incomes").select('id, amount, hours, "desc"').eq("zone_id", zoneId).not("amount", "like", PLAINTEXT_FILTER),
      supabase.from("expenses").select('id, amount, "desc"').eq("zone_id", zoneId).not("amount", "like", PLAINTEXT_FILTER),
      supabase.from("recurring_expenses").select('id, amount, "desc"').eq("zone_id", zoneId).not("amount", "like", PLAINTEXT_FILTER),
      supabase.from("recurring_incomes").select('id, amount, hours, "desc"').eq("zone_id", zoneId).not("amount", "like", PLAINTEXT_FILTER),
      supabase.from("savings_entries").select('id, amount, "desc"').eq("zone_id", zoneId).not("amount", "like", PLAINTEXT_FILTER),
      supabase.from("savings_state").select("zone_id, initial").eq("zone_id", zoneId).not("initial", "like", PLAINTEXT_FILTER).maybeSingle(),
      supabase.from("category_budgets").select("zone_id, category_id, amount").eq("zone_id", zoneId).not("amount", "like", PLAINTEXT_FILTER),
    ]);

    for (const row of incomes.data ?? []) {
      jobs.push(async () => {
        await supabase
          .from("incomes")
          .update({
            amount: await encryptNumber(dek, Number(row.amount)),
            hours: await encryptNumber(dek, Number(row.hours)),
            desc: await encryptText(dek, row.desc ?? ""),
          })
          .eq("id", row.id)
          .not("amount", "like", PLAINTEXT_FILTER);
      });
    }
    for (const row of expenses.data ?? []) {
      jobs.push(async () => {
        await supabase
          .from("expenses")
          .update({ amount: await encryptNumber(dek, Number(row.amount)), desc: await encryptText(dek, row.desc ?? "") })
          .eq("id", row.id)
          .not("amount", "like", PLAINTEXT_FILTER);
      });
    }
    for (const row of recurringExpenses.data ?? []) {
      jobs.push(async () => {
        await supabase
          .from("recurring_expenses")
          .update({ amount: await encryptNumber(dek, Number(row.amount)), desc: await encryptText(dek, row.desc ?? "") })
          .eq("id", row.id)
          .not("amount", "like", PLAINTEXT_FILTER);
      });
    }
    for (const row of recurringIncomes.data ?? []) {
      jobs.push(async () => {
        await supabase
          .from("recurring_incomes")
          .update({
            amount: await encryptNumber(dek, Number(row.amount)),
            hours: await encryptNumber(dek, Number(row.hours)),
            desc: await encryptText(dek, row.desc ?? ""),
          })
          .eq("id", row.id)
          .not("amount", "like", PLAINTEXT_FILTER);
      });
    }
    for (const row of savingsEntries.data ?? []) {
      jobs.push(async () => {
        await supabase
          .from("savings_entries")
          .update({ amount: await encryptNumber(dek, Number(row.amount)), desc: await encryptText(dek, row.desc ?? "") })
          .eq("id", row.id)
          .not("amount", "like", PLAINTEXT_FILTER);
      });
    }
    if (savingsState.data) {
      const initial = savingsState.data.initial;
      jobs.push(async () => {
        await supabase
          .from("savings_state")
          .update({ initial: await encryptNumber(dek, Number(initial)) })
          .eq("zone_id", zoneId)
          .not("initial", "like", PLAINTEXT_FILTER);
      });
    }
    for (const row of budgets.data ?? []) {
      jobs.push(async () => {
        await supabase
          .from("category_budgets")
          .update({ amount: await encryptNumber(dek, Number(row.amount)) })
          .eq("zone_id", row.zone_id)
          .eq("category_id", row.category_id)
          .not("amount", "like", PLAINTEXT_FILTER);
      });
    }
  }

  const total = jobs.length;
  let done = 0;
  onProgress?.(0, total);
  const CONCURRENCY = 5;
  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    await Promise.all(jobs.slice(i, i + CONCURRENCY).map((job) => job()));
    done = Math.min(i + CONCURRENCY, total);
    onProgress?.(done, total);
  }
}
