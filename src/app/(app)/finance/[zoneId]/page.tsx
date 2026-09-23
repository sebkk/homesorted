import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FinanceView } from "@/components/finance/FinanceView";

export default async function FinanceZonePage({ params }: { params: { zoneId: string } }) {
  const supabase = createClient();
  const { data: zone } = await supabase.from("zones").select("*").eq("id", params.zoneId).maybeSingle();

  if (!zone) notFound();

  return <FinanceView zoneId={zone.id} zoneName={zone.name} />;
}
