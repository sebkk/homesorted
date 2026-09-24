import { cache } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { FinanceView } from "@/components/finance/FinanceView";

// Shared by generateMetadata and the page, so the zone is fetched once per request.
const getZone = cache(async (zoneId: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("zones").select("*").eq("id", zoneId).maybeSingle();
  return data;
});

export async function generateMetadata({ params }: { params: Promise<{ zoneId: string }> }) {
  const zone = await getZone((await params).zoneId);
  // A missing zone renders the 404 page, but the tab title still comes from here.
  return { title: zone ? zone.name : (await getTranslations("errorPages"))("notFoundTitle") };
}

export default async function FinanceZonePage({ params }: { params: Promise<{ zoneId: string }> }) {
  const { zoneId } = await params;
  const zone = await getZone(zoneId);

  if (!zone) notFound();

  return (
    <FinanceView
      zoneId={zone.id}
      zoneName={zone.name}
      zoneCurrency={zone.currency ?? "PLN"}
      period={{ startDay: zone.month_start_day ?? 1, label: zone.month_label === "end" ? "end" : "start" }}
    />
  );
}
