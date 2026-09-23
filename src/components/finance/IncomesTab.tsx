"use client";

import { useState } from "react";
import { useZoneData } from "@/lib/useZoneData";
import { fmt, incomesForMonth, monthIncomeTotal, monthLabel, resolveIcon } from "@/lib/finance";
import { Income, INCOME_TYPE_ICONS, INCOME_TYPE_LABELS } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { Collapsible } from "@/components/ui/Collapsible";
import { TrashIcon, PencilIcon, ChevronIcon } from "@/components/finance/icons";

export function IncomesTab({
  zd,
  onEditIncome,
}: {
  zd: ReturnType<typeof useZoneData>;
  onEditIncome: (income: Income) => void;
}) {
  const { showToast } = useToast();
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());
  const months = Array.from(new Set(zd.incomes.map((x) => x.month))).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));

  function toggleMonth(m: string) {
    setCollapsedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  }

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
      {months.length === 0 ? (
        <div className="text-center py-10 px-5 text-ink-muted text-[13px]">
          Brak wpisów. Dodaj zarobek przez przycisk +.
        </div>
      ) : (
        months.map((m) => {
          const items = incomesForMonth(zd.incomes, m);
          const total = monthIncomeTotal(zd.incomes, m);
          const isOpen = !collapsedMonths.has(m);
          return (
            <div key={m} className="mb-[18px]">
              <button
                type="button"
                onClick={() => toggleMonth(m)}
                className="w-full flex items-center justify-between px-0.5 pb-2 text-[13px] font-semibold text-ink-muted border-none bg-transparent"
              >
                <span className="flex items-center gap-1.5">
                  <ChevronIcon open={isOpen} />
                  {monthLabel(m)}
                </span>
                <b className="tabular-nums text-ink font-bold">{fmt(total)}</b>
              </button>
              <Collapsible open={isOpen}>
                <div className="flex flex-col gap-2">
                  {items.map((e) => {
                    const isB2b = e.type === "b2b" || !e.type;
                    const subParts = [];
                    if (e.hours) subParts.push(`${e.hours} h · ${fmt(e.amount / e.hours, 2)}/h`);
                    if (!isB2b && e.desc) subParts.push(e.desc);
                    return (
                      <div key={e.id} className="bg-surface-2 border border-border rounded-md p-3 flex items-center gap-3">
                        <span className="w-9 h-9 rounded-md bg-good-soft text-good flex items-center justify-center shrink-0 text-[17px]">
                          {resolveIcon(e.icon, INCOME_TYPE_ICONS[e.type])}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13.5px] font-semibold truncate">{INCOME_TYPE_LABELS[e.type]}</div>
                          {subParts.length > 0 && (
                            <div className="text-xs text-ink-muted mt-0.5 truncate">{subParts.join(" · ")}</div>
                          )}
                        </div>
                        <div className="tabular-nums font-bold text-sm text-good shrink-0">{fmt(e.amount)}</div>
                        <button
                          type="button"
                          aria-label="Edytuj"
                          onClick={() => onEditIncome(e)}
                          className="shrink-0 w-7 h-7 rounded-md border-none bg-transparent text-ink-faint flex items-center justify-center hover:bg-accent-soft hover:text-accent"
                        >
                          <PencilIcon />
                        </button>
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
              </Collapsible>
            </div>
          );
        })
      )}
    </div>
  );
}
