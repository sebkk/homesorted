"use client";

import { useState } from "react";
import { useZoneData } from "@/lib/useZoneData";
import { useCategories } from "@/lib/useCategories";
import { allMonthsSorted, expensesForMonth, fmt, monthLabel, monthLabelGenitive, resolveIcon } from "@/lib/finance";
import { Expense, RecurringExpense } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { Collapsible } from "@/components/ui/Collapsible";
import { TrashIcon, RecurringIcon, PencilIcon, ChevronIcon } from "@/components/finance/icons";

const RECURRING_PREVIEW_COUNT = 2;

export function ExpensesTab({
  zd,
  currentMonth,
  onOpenRecurringMenu,
  onEditExpense,
  onEditRecurring,
}: {
  zd: ReturnType<typeof useZoneData>;
  currentMonth: string;
  onOpenRecurringMenu: (templateId: string, month: string) => void;
  onEditExpense: (expense: Expense) => void;
  onEditRecurring: (recurring: RecurringExpense) => void;
}) {
  const { showToast } = useToast();
  const { incomes, expenses, recurring } = zd;
  const categories = useCategories();
  const categoryIcon = (category: string) => categories.find((c) => c.name === category)?.icon;
  const [showAllRecurring, setShowAllRecurring] = useState(false);
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());

  function toggleMonth(m: string) {
    setCollapsedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  }

  const months = allMonthsSorted(incomes, expenses, recurring, currentMonth)
    .slice()
    .reverse()
    .filter((m) => expensesForMonth(expenses, recurring, m).length > 0);

  const activeRecurring = recurring
    .filter((r) => !r.end_month || currentMonth < r.end_month)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
  const previewRecurring = activeRecurring.slice(0, RECURRING_PREVIEW_COUNT);
  const extraRecurring = activeRecurring.slice(RECURRING_PREVIEW_COUNT);

  async function handleDeleteExpense(id: string) {
    const removed = await zd.deleteExpense(id);
    if (!removed) return;
    showToast(`Usunięto: ${removed.desc || removed.category}`, () => zd.restoreExpense(removed));
  }

  async function handleDisableRecurringNow(templateId: string, label: string) {
    const prevEnd = await zd.disableRecurringFrom(templateId, currentMonth);
    showToast(`Wyłączono od ${monthLabelGenitive(currentMonth)}: ${label} — wcześniejsze miesiące bez zmian`, () =>
      zd.restoreRecurringEnd(templateId, prevEnd ?? null)
    );
  }

  return (
    <div className="pb-2">
      {activeRecurring.length > 0 && (
        <>
          <div className="text-[13px] font-semibold text-ink-muted uppercase tracking-wide mb-2.5">
            Wydatki stałe (co miesiąc)
          </div>
          <div className="flex flex-col gap-2">
            {previewRecurring.map((r) => (
              <RecurringRow
                key={r.id}
                r={r}
                icon={resolveIcon(r.icon, categoryIcon(r.category))}
                onEdit={() => onEditRecurring(r)}
                onDisable={() => handleDisableRecurringNow(r.id, r.desc || r.category)}
              />
            ))}
          </div>
          {extraRecurring.length > 0 && (
            <>
              <Collapsible open={showAllRecurring}>
                <div className="flex flex-col gap-2 pt-2">
                  {extraRecurring.map((r) => (
                    <RecurringRow
                      key={r.id}
                      r={r}
                      icon={resolveIcon(r.icon, categoryIcon(r.category))}
                      onEdit={() => onEditRecurring(r)}
                      onDisable={() => handleDisableRecurringNow(r.id, r.desc || r.category)}
                    />
                  ))}
                </div>
              </Collapsible>
              <button
                type="button"
                onClick={() => setShowAllRecurring((v) => !v)}
                className="flex items-center gap-1 text-[12.5px] font-semibold text-accent bg-transparent border-none mb-[22px] mt-2"
              >
                <ChevronIcon open={showAllRecurring} size={13} />
                {showAllRecurring ? "Pokaż mniej" : `Pokaż więcej (${extraRecurring.length})`}
              </button>
            </>
          )}
          {extraRecurring.length === 0 && <div className="mb-[22px]" />}
        </>
      )}

      <div className="text-[13px] font-semibold text-ink-muted uppercase tracking-wide mb-2.5">Wydatki miesięczne</div>
      {months.length === 0 ? (
        <div className="text-center py-10 px-5 text-ink-muted text-[13px]">
          Brak wydatków. Dodaj pierwszy przez przycisk +.
        </div>
      ) : (
        months.map((m) => {
          const items = expensesForMonth(expenses, recurring, m).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
          const total = items.reduce((s, x) => s + x.amount, 0);
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
              <div className="flex flex-col gap-2 pt-0">
                {items.map((x) => (
                  <div key={x.id} className="bg-surface-2 border border-border rounded-md p-3 flex items-center gap-3">
                    <span className="w-9 h-9 rounded-md bg-critical-soft text-critical flex items-center justify-center shrink-0 text-[17px]">
                      {resolveIcon(x.icon, categoryIcon(x.category))}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-semibold truncate">{x.desc || x.category}</div>
                      <div className="text-xs text-ink-muted mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <Badge>{x.category}</Badge>
                        {"recurring" in x && x.recurring && (
                          <Badge>
                            <RecurringIcon size={9} /> Stałe
                          </Badge>
                        )}
                        <span>{x.date}</span>
                      </div>
                    </div>
                    <div className="tabular-nums font-bold text-sm text-critical shrink-0">−{fmt(x.amount)}</div>
                    {"recurring" in x && x.recurring ? (
                      <button
                        type="button"
                        aria-label="Wyłącz wydatek stały"
                        onClick={() => onOpenRecurringMenu(x.templateId, x.month)}
                        className="shrink-0 w-7 h-7 rounded-md border-none bg-transparent text-ink-faint flex items-center justify-center hover:bg-critical-soft hover:text-critical"
                      >
                        <TrashIcon />
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          aria-label="Edytuj"
                          onClick={() => onEditExpense(x as Expense)}
                          className="shrink-0 w-7 h-7 rounded-md border-none bg-transparent text-ink-faint flex items-center justify-center hover:bg-accent-soft hover:text-accent"
                        >
                          <PencilIcon />
                        </button>
                        <button
                          type="button"
                          aria-label="Usuń"
                          onClick={() => handleDeleteExpense(x.id)}
                          className="shrink-0 w-7 h-7 rounded-md border-none bg-transparent text-ink-faint flex items-center justify-center hover:bg-critical-soft hover:text-critical"
                        >
                          <TrashIcon />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
              </Collapsible>
            </div>
          );
        })
      )}
    </div>
  );
}

function RecurringRow({
  r,
  icon,
  onEdit,
  onDisable,
}: {
  r: RecurringExpense;
  icon: string;
  onEdit: () => void;
  onDisable: () => void;
}) {
  return (
    <div className="bg-surface-2 border border-border rounded-md p-3 flex items-center gap-3">
      <span className="relative w-9 h-9 rounded-md bg-critical-soft text-critical flex items-center justify-center shrink-0 text-[17px]">
        {icon}
        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-surface-2 border border-border flex items-center justify-center text-critical">
          <RecurringIcon />
        </span>
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-semibold truncate">{r.desc || r.category}</div>
        <div className="text-xs text-ink-muted mt-0.5 flex items-center gap-1.5 flex-wrap">
          <Badge>{r.category}</Badge>
          <span>co miesiąc, od {monthLabelGenitive(r.start_month)}</span>
        </div>
      </div>
      <div className="tabular-nums font-bold text-sm text-critical shrink-0">−{fmt(r.amount)}</div>
      <button
        type="button"
        aria-label="Edytuj wydatek stały"
        onClick={onEdit}
        className="shrink-0 w-7 h-7 rounded-md border-none bg-transparent text-ink-faint flex items-center justify-center hover:bg-accent-soft hover:text-accent"
      >
        <PencilIcon />
      </button>
      <button
        type="button"
        aria-label="Wyłącz wydatek stały od teraz"
        onClick={onDisable}
        className="shrink-0 w-7 h-7 rounded-md border-none bg-transparent text-ink-faint flex items-center justify-center hover:bg-critical-soft hover:text-critical"
      >
        <TrashIcon />
      </button>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-surface-3 text-ink-muted">
      {children}
    </span>
  );
}
