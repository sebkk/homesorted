"use server";

import { redirect } from "next/navigation";
import { isSupportedCurrency } from "@/lib/currencies";
import { MAX_ZONE_NAME, ZONE_COLORS } from "@/lib/types";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Enforced here too: server actions are callable with arbitrary input.
const validZoneName = (name: string) => name.trim().length > 0 && name.trim().length <= MAX_ZONE_NAME;

/** A zone's editable settings; the month definition is MonthPeriod in finance.ts. */
interface ZoneSettings {
  name: string;
  color: number;
  monthStartDay: number;
  monthLabel: string;
}

function zoneSettingsError({ name, color, monthStartDay, monthLabel }: ZoneSettings) {
  if (!validZoneName(name)) return "invalid name";
  if (!Number.isInteger(color) || color < 1 || color > ZONE_COLORS) return "invalid color";
  if (!Number.isInteger(monthStartDay) || monthStartDay < 1 || monthStartDay > 28) return "invalid start day";
  if (monthLabel !== "start" && monthLabel !== "end") return "invalid label";
  return null;
}

export async function createZone(fields: ZoneSettings & { currency: string }) {
  const { name, color, monthStartDay, monthLabel, currency } = fields;
  // Server actions are callable with arbitrary input: only accept known codes.
  if (!isSupportedCurrency(currency)) return { data: null, error: "unsupported currency" };
  const invalid = zoneSettingsError(fields);
  if (invalid) return { data: null, error: invalid };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("zones")
    .insert({
      user_id: user.id,
      name: name.trim(),
      color,
      pinned: false,
      currency,
      month_start_day: monthStartDay,
      month_label: monthLabel,
    })
    .select()
    .single();

  revalidatePath("/launcher");
  revalidatePath("/zones");
  return { data, error: error?.message ?? null };
}

/** Saves a zone's name, color and month definition. The currency is fixed at creation. */
export async function updateZone(zoneId: string, fields: ZoneSettings) {
  const invalid = zoneSettingsError(fields);
  if (invalid) return { error: invalid };
  const { name, color, monthStartDay, monthLabel } = fields;
  const supabase = await createClient();
  // RLS limits this to the caller's own zones; zero rows means not theirs.
  const { data, error } = await supabase
    .from("zones")
    .update({ name: name.trim(), color, month_start_day: monthStartDay, month_label: monthLabel })
    .eq("id", zoneId)
    .select("id");
  if (!error && !data?.length) return { error: "not found" };
  revalidatePath("/launcher");
  revalidatePath("/zones");
  revalidatePath(`/finance/${zoneId}`);
  return { error: error?.message ?? null };
}

/** Deletes a zone and — through ON DELETE CASCADE — every income, expense,
 * recurring template, savings entry and budget in it. Irreversible. */
export async function deleteZone(zoneId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("zones").delete().eq("id", zoneId).select("id");
  if (!error && !data?.length) return { error: "not found" };
  revalidatePath("/launcher");
  revalidatePath("/zones");
  return { error: error?.message ?? null };
}

export async function togglePinZone(zoneId: string, pinned: boolean) {
  const supabase = await createClient();
  await supabase.from("zones").update({ pinned }).eq("id", zoneId);
  revalidatePath("/launcher");
  revalidatePath("/zones");
}
