"use server";

import { redirect } from "next/navigation";
import { isSupportedCurrency } from "@/lib/currencies";
import { MAX_ZONE_NAME } from "@/lib/types";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Enforced here too: server actions are callable with arbitrary input.
const validZoneName = (name: string) => name.trim().length > 0 && name.trim().length <= MAX_ZONE_NAME;

export async function createZone(name: string, currency = "PLN") {
  // Server actions are callable with arbitrary input: only accept known codes.
  if (!isSupportedCurrency(currency)) return { data: null, error: "unsupported currency" };
  if (!validZoneName(name)) return { data: null, error: "invalid name" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { count } = await supabase.from("zones").select("*", { count: "exact", head: true }).eq("user_id", user.id);
  const color = ((count ?? 0) % 8) + 1;

  const { data, error } = await supabase
    .from("zones")
    .insert({ user_id: user.id, name: name.trim() || "Strefa", color, pinned: false, currency })
    .select()
    .single();

  revalidatePath("/launcher");
  revalidatePath("/zones");
  return { data, error: error?.message ?? null };
}

export async function renameZone(zoneId: string, name: string) {
  if (!validZoneName(name)) return { error: "invalid name" };
  const supabase = await createClient();
  // RLS limits this to the caller's own zones; zero rows means not theirs.
  const { data, error } = await supabase.from("zones").update({ name: name.trim() }).eq("id", zoneId).select("id");
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
