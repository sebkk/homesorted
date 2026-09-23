"use server";

import { redirect } from "next/navigation";
import { isSupportedCurrency } from "@/lib/currencies";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createZone(name: string, currency = "PLN") {
  // Server actions are callable with arbitrary input: only accept known codes.
  if (!isSupportedCurrency(currency)) return { data: null, error: "unsupported currency" };
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

export async function togglePinZone(zoneId: string, pinned: boolean) {
  const supabase = await createClient();
  await supabase.from("zones").update({ pinned }).eq("id", zoneId);
  revalidatePath("/launcher");
  revalidatePath("/zones");
}
