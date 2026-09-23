"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createZone(name: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { count } = await supabase.from("zones").select("*", { count: "exact", head: true }).eq("user_id", user.id);
  const color = ((count ?? 0) % 8) + 1;

  const { data, error } = await supabase
    .from("zones")
    .insert({ user_id: user.id, name: name.trim() || "Strefa", color, pinned: false })
    .select()
    .single();

  revalidatePath("/launcher");
  revalidatePath("/zones");
  return { data, error: error?.message ?? null };
}

export async function togglePinZone(zoneId: string, pinned: boolean) {
  const supabase = createClient();
  await supabase.from("zones").update({ pinned }).eq("id", zoneId);
  revalidatePath("/launcher");
  revalidatePath("/zones");
}
