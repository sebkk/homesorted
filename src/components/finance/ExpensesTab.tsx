"use client";

import { useZoneData } from "@/lib/useZoneData";
import { allMonthsSorted, expensesForMonth, fmt, monthLabel } from "@/lib/finance";
import { useToast } from "@/components/ui/Toast";
import { TrashIcon, RecurringIcon, ExpenseIcon } from "@/components/finance/icons";

export function ExpensesTab({
  zd,
  currentMonth,
  onOpenRecurringMenu,
}: {
  zd: ReturnType<typeof useZoneData>;
  currentMonth: string;
  onOpenRecurringMenu: (templateId: string, month: string) => void;
}) {
  const { showToast } = useToast();
  const { incomes, expenses, recurring } = zd;

  const months = allMonthsSorted(incomes, expenses, recurring, currentMonth)
    .slice()
    .reverse()
    .filter((m) => expensesForMonth(expenses, recurring, m).length > 0);

  const activeRecurring = recurring.filter((r) => !r.end_month || currentMonth < r.end_month);

  async function handleDeleteExpense(id: string) {
    const removed = await zd.deleteExpense(id);
    if (!removed) return;
    showToast(`Usunięto: ${removed.desc || removed.category}`, () => zd.restoreExpense(removed));
  }

  async function handleDisableRecurringNow(templateId: string, label: string) {
    const prevEnd = await zd.disableRecurringFrom(templateId, currentMonth);
    showToast(`Wyłączono od ${monthLabel(currentMonth)}: ${label} — wcześniejsze miesiące bez zmian`, () =>
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
          <div className="flex flex-col gap-2 mb-[22px]">
            {activeRecurring.map((r) => (
              <div key={r.id} className="bg-surface-2 border border-border rounded-md p-3 flex items-center gap-3">
                <span className="w-9 h-9 rounded-md bg-critical-soft text-critical flex items-center justify-center shrink-0">
                  <RecurringIcon />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold truncate">{r.desc || r.category}</div>
                  <div className="text-xs text-ink-muted mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <Badge>{r.category}</Badge>
                    <span>co miesiąc, od {monthLabel(r.start_month)}</span>
                  </div>
                </div>
                <div className="tabular-nums font-bold text-sm text-critical shrink-0">−{fmt(r.amount)}</div>
                <button
                  type="button"
                  aria-label="Wyłącz wydatek stały od teraz"
                  onClick={() => handleDisableRecurringNow(r.id, r.desc || r.category)}
                  className="shrink-0 w-7 h-7 rounded-md border-none bg-transparent text-ink-faint flex items-center justify-center hover:bg-critical-soft hover:text-critical"
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="text-[13px] font-semibold text-ink-muted uppercase tracking-wide mb-2.5">Wydatki miesięczne</div>
      {months.length === 0 ? (
        <div className="text-center py-10 px-5 text-ink-muted text-[13px]">
          Brak wydatków. Dodaj pierwszy przez przycisk +.
        </div>
      ) : (
        months.map((m) => {
          const items = expensesForMonth(expenses, recurring, m).sort((a, b) => (a.date < b.date ? 1 : -1));
          const total = items.reduce((s, x) => s + x.amount, 0);
          return (
            <div key={m} className="mb-[18px]">
              <div className="flex items-baseline justify-between px-0.5 pb-2 text-[13px] font-semibold text-ink-muted">
                <span>{monthLabel(m)}</span>
                <b className="tabular-nums text-ink font-bold">{fmt(total)}</b>
              </div>
              <div className="flex flex-col gap-2">
                {items.map((x) => (
                  <div key={x.id} className="bg-surface-2 border border-border rounded-md p-3 flex items-center gap-3">
                    <span className="w-9 h-9 rounded-md bg-critical-soft text-critical flex items-center justify-center shrink-0">
                      <ExpenseIcon />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-semibold truncate">{x.desc || x.category}</div>
                      <div className="text-xs text-ink-muted mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <Badge>{x.category}</Badge>
                        {"recurring" in x && x.recurring && <Badge>Stałe</Badge>}
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
                      <button
                        type="button"
                        aria-label="Usuń"
                        onClick={() => handleDeleteExpense(x.id)}
                        className="shrink-0 w-7 h-7 rounded-md border-none bg-transparent text-ink-faint flex items-center justify-center hover:bg-critical-soft hover:text-critical"
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-surface-3 text-ink-muted">{children}</span>;
}
