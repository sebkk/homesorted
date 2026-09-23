"use client";

import { useZoneData } from "@/lib/useZoneData";
import { fmt, monthLabel } from "@/lib/finance";
import { INCOME_TYPE_LABELS } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { TrashIcon } from "@/components/finance/icons";

export function IncomesTab({ zd }: { zd: ReturnType<typeof useZoneData> }) {
  const { showToast } = useToast();
  const items = [...zd.incomes].sort((a, b) => (a.month < b.month ? 1 : -1));

  async function handleDelete(id: string) {
    const removed = await zd.deleteIncome(id);
    if (!removed) return;
    showToast(`Usunięto wpis: ${INCOME_TYPE_LABELS[removed.type]}, ${monthLabel(removed.month)}`, () => {
      zd.restoreIncome(removed);
    });
  }

  return (
    <div className="pb-2">
      <div className="text-[13px] font-semibold text-ink-muted uppercase tracking-wide mb-2.5">Zarobki</div>
      {items.length === 0 ? (
        <div className="text-center py-10 px-5 text-ink-muted text-[13px]">
          Brak wpisów. Dodaj zarobek przez przycisk +.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((e) => {
            const isB2b = e.type === "b2b" || !e.type;
            const subParts = [monthLabel(e.month)];
            if (e.hours) subParts.push(`${e.hours} h · ${fmt(e.amount / e.hours, 2)}/h`);
            if (!isB2b && e.desc) subParts.push(e.desc);
            return (
              <div key={e.id} className="bg-surface-2 border border-border rounded-md p-3 flex items-center gap-3">
                <span className="w-9 h-9 rounded-md bg-good-soft text-good flex items-center justify-center shrink-0">
                  <IncomeIcon type={e.type} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold truncate">{INCOME_TYPE_LABELS[e.type]}</div>
                  <div className="text-xs text-ink-muted mt-0.5 truncate">{subParts.join(" · ")}</div>
                </div>
                <div className="tabular-nums font-bold text-sm text-good shrink-0">{fmt(e.amount)}</div>
                <button
                  type="button"
                  aria-label="Usuń"
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

function IncomeIcon({ type }: { type: string }) {
  if (type === "inne") {
    return (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="8" width="18" height="4" rx="1" />
        <path d="M12 8v13M19 12v9H5v-9" />
        <path d="M12 8c-1.5 0-3-1-3-2.5S10 3 11.5 3 14 4.5 14 6" />
        <path d="M12 8c1.5 0 3-1 3-2.5S13 3 11.5 3 9 4.5 9 6" />
      </svg>
    );
  }
  if (type === "uop" || type === "uz" || type === "uod") {
    return (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        <path d="M2 13h20" />
      </svg>
    );
  }
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </svg>
  );
}
