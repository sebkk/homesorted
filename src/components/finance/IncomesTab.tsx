"use client";

import { useZoneData } from "@/lib/useZoneData";
import { allMonthsSorted, fmt, incomesForMonth, monthLabel, monthLabelGenitive, resolveIcon } from "@/lib/finance";
import { Income, INCOME_TYPE_ICONS, INCOME_TYPE_LABELS, RecurringIncome } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { TrashIcon, PencilIcon, RecurringIcon } from "@/components/finance/icons";
import { Badge, RecurringRowData, RecurringSection, splitTemplates } from "@/components/finance/RecurringSection";
import { MonthGroup } from "@/components/finance/MonthGroup";
import { IconButton } from "@/components/finance/IconButton";

export function IncomesTab({
  zd,
  currentMonth,
  onEditIncome,
  onEditRecurring,
  onOpenRecurringMenu,
}: {
  zd: ReturnType<typeof useZoneData>;
  currentMonth: string;
  onEditIncome: (income: Income) => void;
  onEditRecurring: (recurring: RecurringIncome) => void;
  onOpenRecurringMenu: (templateId: string, month: string) => void;
}) {
  const { showToast } = useToast();
  const { incomes, recurringIncomes } = zd;

  const months = allMonthsSorted(incomes, [], recurringIncomes, currentMonth)
    .reverse()
    .filter((m) => incomesForMonth(incomes, recurringIncomes, m).length > 0);

  const { active, ended } = splitTemplates(recurringIncomes, currentMonth);
  const toRow = (r: RecurringIncome): RecurringRowData => ({
    id: r.id,
    icon: resolveIcon(r.icon, INCOME_TYPE_ICONS[r.type]),
    title: r.desc || INCOME_TYPE_LABELS[r.type],
    badge: INCOME_TYPE_LABELS[r.type],
    amount: fmt(r.amount),
    template: r,
  });

  async function handleDelete(id: string) {
    const removed = await zd.deleteIncome(id);
    if (!removed) return;
    showToast(`Usunięto wpis: ${INCOME_TYPE_LABELS[removed.type]}, ${monthLabel(removed.month)}`, () => {
      zd.restoreIncome(removed);
    });
  }

  async function handleDisableNow(id: string) {
    const tpl = recurringIncomes.find((r) => r.id === id);
    const result = await zd.recurringIncomeOps.disableFrom(id, currentMonth);
    if (!tpl || !result) return;
    const label = tpl.desc || INCOME_TYPE_LABELS[tpl.type];
    showToast(
      result.deleted
        ? `Usunięto zarobek stały: ${label}`
        : `Wyłączono od ${monthLabelGenitive(currentMonth)}: ${label} — wcześniejsze miesiące bez zmian`,
      result.undo
    );
  }

  return (
    <div className="pb-2">
      <RecurringSection
        title="Zarobki stałe (co miesiąc)"
        tone="good"
        active={active.map(toRow)}
        ended={ended.map(toRow)}
        onEdit={(id) => {
          const tpl = recurringIncomes.find((r) => r.id === id);
          if (tpl) onEditRecurring(tpl);
        }}
        onDisable={handleDisableNow}
      />

      <div className="text-[13px] font-semibold text-ink-muted uppercase tracking-wide mb-2.5">Zarobki</div>
      {months.length === 0 ? (
        <div className="text-center py-10 px-5 text-ink-muted text-[13px]">Brak wpisów. Dodaj zarobek przez przycisk +.</div>
      ) : (
        months.map((m) => {
          const items = incomesForMonth(incomes, recurringIncomes, m);
          return (
            <MonthGroup key={m} month={m} total={items.reduce((s, x) => s + x.amount, 0)}>
              {items.map((e) => {
                const isRecurring = "recurring" in e;
                const subParts: string[] = [];
                if (e.hours) subParts.push(`${e.hours} h · ${fmt(e.amount / e.hours, 2)}/h`);
                if (e.desc && (e.type !== "b2b" || isRecurring)) subParts.push(e.desc);
                return (
                  <div key={e.id} className="bg-surface-2 border border-border rounded-md p-3 flex items-center gap-3">
                    <span className="w-9 h-9 rounded-md bg-good-soft text-good flex items-center justify-center shrink-0 text-[17px]">
                      {resolveIcon(e.icon, INCOME_TYPE_ICONS[e.type])}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-semibold truncate">{INCOME_TYPE_LABELS[e.type]}</div>
                      {(isRecurring || subParts.length > 0) && (
                        <div className="text-xs text-ink-muted mt-0.5 flex items-center gap-1.5 flex-wrap min-w-0">
                          {isRecurring && (
                            <Badge>
                              <RecurringIcon size={9} /> Stałe
                            </Badge>
                          )}
                          {subParts.length > 0 && <span className="truncate">{subParts.join(" · ")}</span>}
                        </div>
                      )}
                    </div>
                    <div className="tabular-nums font-bold text-sm text-good shrink-0">{fmt(e.amount)}</div>
                    {isRecurring ? (
                      <IconButton label="Pomiń lub wyłącz zarobek stały" onClick={() => onOpenRecurringMenu(e.templateId, e.month)} danger>
                        <TrashIcon />
                      </IconButton>
                    ) : (
                      <>
                        <IconButton label="Edytuj" onClick={() => onEditIncome(e)}>
                          <PencilIcon />
                        </IconButton>
                        <IconButton label="Usuń" onClick={() => handleDelete(e.id)} danger>
                          <TrashIcon />
                        </IconButton>
                      </>
                    )}
                  </div>
                );
              })}
            </MonthGroup>
          );
        })
      )}
    </div>
  );
}
