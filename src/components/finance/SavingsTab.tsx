"use client";

import { useTranslations } from "next-intl";
import { useZoneData } from "@/lib/useZoneData";
import { useMoney } from "@/components/finance/MoneyContext";
import { baseAmount, savingsBalance } from "@/lib/finance";
import { SavingsEntry } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { TrashIcon, PencilIcon } from "@/components/finance/icons";

export function SavingsTab({
  zd,
  onEditInitial,
  onEditEntry,
}: {
  zd: ReturnType<typeof useZoneData>;
  onEditInitial: () => void;
  onEditEntry: (entry: SavingsEntry) => void;
}) {
  const t = useTranslations("savings");
  const tc = useTranslations("common");
  const { fmt, currency } = useMoney();
  const { showToast } = useToast();
  const balance = savingsBalance(zd.savingsInitial, zd.savingsEntries);
  const entries = [...zd.savingsEntries].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  async function handleDelete(id: string) {
    const removed = await zd.deleteSavingsEntry(id);
    if (!removed) return;
    showToast(t("deleted", { label: removed.desc || t("entry") }), () => zd.restoreSavingsEntry(removed));
  }

  return (
    <div className="pb-2">
      <div className="mt-3.5 p-5 rounded-xl bg-surface-2 border border-border shadow-glass">
        <div className="text-[12.5px] text-ink-muted font-medium">{t("balance")}</div>
        <div className="tabular-nums font-bold tracking-tight text-[38px] mt-1 text-accent">{fmt(balance)}</div>
        <button
          type="button"
          onClick={onEditInitial}
          className="mt-2.5 font-semibold text-[13px] text-accent bg-accent-soft border-none rounded-md py-2 px-3.5"
        >
          {t("setInitial", { amount: fmt(zd.savingsInitial) })}
        </button>
      </div>

      <div className="text-[13px] font-semibold text-ink-muted uppercase tracking-wide mt-[22px] mb-2.5">{t("history")}</div>
      {entries.length === 0 ? (
        <div className="text-center py-10 px-5 text-ink-muted text-[13px]">
          {t("empty")}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((e) => {
            const good = e.amount >= 0;
            return (
              <div key={e.id} className="bg-surface-2 border border-border rounded-md p-3 flex items-center gap-3">
                <span className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${good ? "bg-good-soft text-good" : "bg-critical-soft text-critical"}`}>
                  {good ? (
                    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                      <path d="M12 5v14M5 12l7-7 7 7" />
                    </svg>
                  ) : (
                    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                      <path d="M12 5v14M5 12l7 7 7-7" />
                    </svg>
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold truncate">{e.desc || (good ? t("deposit") : t("withdrawal"))}</div>
                  <div className="text-xs text-ink-muted mt-0.5">{e.date}</div>
                </div>
                <div className="tabular-nums text-right shrink-0">
                  <div className={`font-bold text-sm ${good ? "text-good" : "text-critical"}`}>
                    {good ? "+" : "−"}
                    {fmt(Math.abs(e.amount), 2, e.currency)}
                  </div>
                  {e.currency !== currency && <div className="text-[11px] text-ink-muted">≈ {fmt(Math.abs(baseAmount(e)))}</div>}
                </div>
                <button
                  type="button"
                  aria-label={tc("edit")}
                  onClick={() => onEditEntry(e)}
                  className="shrink-0 w-7 h-7 rounded-md border-none bg-transparent text-ink-faint flex items-center justify-center hover:bg-accent-soft hover:text-accent"
                >
                  <PencilIcon />
                </button>
                <button
                  type="button"
                  aria-label={tc("delete")}
                  onClick={() => handleDelete(e.id)}
                  className="shrink-0 w-7 h-7 rounded-md border-none bg-transparent text-ink-faint flex items-center justify-center hover:bg-critical-soft hover:text-critical"
                >
                  <TrashIcon />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
