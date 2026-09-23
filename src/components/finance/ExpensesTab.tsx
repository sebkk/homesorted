"use client";

import { useZoneData } from "@/lib/useZoneData";
import { useCategories } from "@/lib/useCategories";
import { allMonthsSorted, expensesForMonth, fmt, monthLabelGenitive, resolveIcon } from "@/lib/finance";
import { Expense, RecurringExpense } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { TrashIcon, RecurringIcon, PencilIcon } from "@/components/finance/icons";
import { Badge, RecurringRowData, RecurringSection, splitTemplates } from "@/components/finance/RecurringSection";
import { MonthGroup } from "@/components/finance/MonthGroup";
import { IconButton } from "@/components/finance/IconButton";

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
  const { expenses, recurring } = zd;
  const categories = useCategories();
  const categoryIcon = (category: string) => categories.find((c) => c.name === category)?.icon;

  const months = allMonthsSorted([], expenses, recurring, currentMonth)
    .reverse()
    .filter((m) => expensesForMonth(expenses, recurring, m).length > 0);

  const { active, ended } = splitTemplates(recurring, currentMonth);
  const toRow = (r: RecurringExpense): RecurringRowData => ({
    id: r.id,
    icon: resolveIcon(r.icon, categoryIcon(r.category)),
    title: r.desc || r.category,
    badge: r.category,
    amount: `−${fmt(r.amount)}`,
    template: r,
  });

  async function handleDeleteExpense(id: string) {
    const removed = await zd.deleteExpense(id);
    if (!removed) return;
    showToast(`Usunięto: ${removed.desc || removed.category}`, () => zd.restoreExpense(removed));
  }

  async function handleDisableNow(id: string) {
    const tpl = recurring.find((r) => r.id === id);
    const result = await zd.recurringExpenseOps.disableFrom(id, currentMonth);
    if (!tpl || !result) return;
    const label = tpl.desc || tpl.category;
    showToast(
      result.deleted
        ? `Usunięto wydatek stały: ${label}`
        : `Wyłączono od ${monthLabelGenitive(currentMonth)}: ${label} — wcześniejsze miesiące bez zmian`,
      result.undo
    );
  }

  return (
    <div className="pb-2">
      <RecurringSection
        title="Wydatki stałe (co miesiąc)"
        tone="critical"
        active={active.map(toRow)}
        ended={ended.map(toRow)}
        onEdit={(id) => {
          const tpl = recurring.find((r) => r.id === id);
          if (tpl) onEditRecurring(tpl);
        }}
        onDisable={handleDisableNow}
      />

      <div className="text-[13px] font-semibold text-ink-muted uppercase tracking-wide mb-2.5">Wydatki miesięczne</div>
      {months.length === 0 ? (
        <div className="text-center py-10 px-5 text-ink-muted text-[13px]">Brak wydatków. Dodaj pierwszy przez przycisk +.</div>
      ) : (
        months.map((m) => {
          const items = expensesForMonth(expenses, recurring, m).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
          return (
            <MonthGroup key={m} month={m} total={items.reduce((s, x) => s + x.amount, 0)}>
              {items.map((x) => {
                const isRecurring = "recurring" in x;
                return (
                  <div key={x.id} className="bg-surface-2 border border-border rounded-md p-3 flex items-center gap-3">
                    <span className="w-9 h-9 rounded-md bg-critical-soft text-critical flex items-center justify-center shrink-0 text-[17px]">
                      {resolveIcon(x.icon, categoryIcon(x.category))}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-semibold truncate">{x.desc || x.category}</div>
                      <div className="text-xs text-ink-muted mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <Badge>{x.category}</Badge>
                        {isRecurring && (
                          <Badge>
                            <RecurringIcon size={9} /> Stałe
                          </Badge>
                        )}
                        <span>{x.date}</span>
                      </div>
                    </div>
                    <div className="tabular-nums font-bold text-sm text-critical shrink-0">−{fmt(x.amount)}</div>
                    {isRecurring ? (
                      <IconButton label="Pomiń lub wyłącz wydatek stały" onClick={() => onOpenRecurringMenu(x.templateId, x.month)} danger>
                        <TrashIcon />
                      </IconButton>
                    ) : (
                      <>
                        <IconButton label="Edytuj" onClick={() => onEditExpense(x)}>
                          <PencilIcon />
                        </IconButton>
                        <IconButton label="Usuń" onClick={() => handleDeleteExpense(x.id)} danger>
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
