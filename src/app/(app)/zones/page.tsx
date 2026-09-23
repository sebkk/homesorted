"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useIntlLocale } from "@/i18n/useFormat";
import { CURRENCIES, currencyName } from "@/lib/currencies";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createZone, togglePinZone } from "@/lib/actions";
import { Zone } from "@/lib/types";
import { Sheet, SheetHeader, Field } from "@/components/ui/Sheet";

const CAT_VARS = [
  "var(--cat1)", "var(--cat2)", "var(--cat3)", "var(--cat4)",
  "var(--cat5)", "var(--cat6)", "var(--cat7)", "var(--cat8)",
];

export default function ZonesPage() {
  const t = useTranslations("zones");
  const tf = useTranslations("finance");
  const intlLocale = useIntlLocale();
  const router = useRouter();
  const supabase = createClient();
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCurrency, setNewCurrency] = useState("PLN");

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("zones")
      .select("*")
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (cancelled) return;
        setZones((data as Zone[]) ?? []);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePin(zone: Zone) {
    setZones((prev) => prev.map((z) => (z.id === zone.id ? { ...z, pinned: !z.pinned } : z)));
    await togglePinZone(zone.id, !zone.pinned);
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    const { data, error } = await createZone(newName.trim(), newCurrency);
    if (!error && data) {
      setSheetOpen(false);
      setNewName("");
      router.push(`/finance/${data.id}`);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="sticky top-0 z-20 bg-surface glass flex items-center justify-between border-b border-border px-5"
        style={{ paddingTop: "calc(14px + env(safe-area-inset-top, 0px))", paddingBottom: "12px" }}>
        <Link
          href="/launcher"
          aria-label={tf("backToLauncher")}
          className="w-8 h-8 rounded-md border border-border bg-surface-2 text-ink-muted flex items-center justify-center"
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <span className="font-bold text-[16px] tracking-tight">{t("title")}</span>
        <button
          type="button"
          aria-label={t("new")}
          onClick={() => setSheetOpen(true)}
          className="w-8 h-8 rounded-md border border-border bg-surface-2 text-ink-muted flex items-center justify-center"
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-5" style={{ paddingTop: "22px", paddingBottom: "28px" }}>
        <div className="text-[13px] text-ink-muted mb-[18px]">
          {t("intro")}
        </div>

        {!loading && zones.length === 0 && (
          <div className="text-center py-10 px-5 text-ink-muted text-[13px]">
            {t("empty")}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {zones.map((zone) => (
            <div key={zone.id} className="bg-surface-2 border border-border rounded-lg p-3 flex items-center gap-3">
              <Link href={`/finance/${zone.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                <span
                  className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
                  style={{ background: CAT_VARS[(zone.color - 1) % 8] + "29", color: CAT_VARS[(zone.color - 1) % 8] }}
                >
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 17l6-6 4 4 8-8" />
                    <path d="M15 7h6v6" />
                  </svg>
                </span>
                <span className="text-[13.5px] font-semibold truncate">{zone.name}</span>
                <span className="text-[11px] font-semibold text-ink-muted shrink-0">{zone.currency}</span>
              </Link>
              <button
                type="button"
                onClick={() => handlePin(zone)}
                aria-label={zone.pinned ? t("unpin") : t("pin")}
                className={`shrink-0 w-8 h-8 rounded-md border flex items-center justify-center ${
                  zone.pinned ? "bg-accent-soft border-transparent text-accent" : "bg-surface border-border text-ink-faint"
                }`}
              >
                <svg width={15} height={15} viewBox="0 0 24 24" fill={zone.pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l1.5 5.5L19 9l-4.5 3.5L16 18l-4-3-4 3 1.5-5.5L5 9l5.5-1.5L12 2Z" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
        <SheetHeader title={t("new")} onClose={() => setSheetOpen(false)} />
        <Field label={t("name")} htmlFor="zoneName">
          <input
            id="zoneName"
            type="text"
            placeholder={t("namePlaceholder")}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="text-[14.5px] font-medium text-ink bg-surface-2 border border-border rounded-md px-3 py-2.5 outline-none focus:border-accent"
          />
        </Field>
        <Field label={t("currency")} htmlFor="zoneCurrency" hint={t("currencyHint")}>
          <select
            id="zoneCurrency"
            value={newCurrency}
            onChange={(e) => setNewCurrency(e.target.value)}
            className="text-[14.5px] font-medium text-ink bg-surface-2 border border-border rounded-md px-3 py-2.5 outline-none focus:border-accent"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c} — {currencyName(c, intlLocale)}
              </option>
            ))}
          </select>
        </Field>
        <button
          type="button"
          onClick={handleCreate}
          className="font-bold text-[14.5px] text-accent-ink bg-accent rounded-md py-3 mb-1"
        >
          {t("create")}
        </button>
      </Sheet>
    </div>
  );
}
