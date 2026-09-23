"use client";

import { useTranslations } from "next-intl";
import { useMonthFormat } from "@/i18n/useFormat";
import { useZoneData } from "@/lib/useZoneData";
import { useMoney } from "@/components/finance/MoneyContext";
import { useCategories } from "@/lib/useCategories";
import { allMonthsSorted, baseAmount, expensesForMonth, resolveIcon } from "@/lib/finance";
import { Expense, RecurringExpense } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { TrashIcon, RecurringIcon, PencilIcon } from "@/components/finance/icons";
import { Badge, RecurringRowData, RecurringSection, splitTemplates } from "@/components/finance/RecurringSection";
import { MonthGroup } from "@/components/finance/MonthGroup";
import { YearSummary } from "@/components/finance/YearSummary";
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
  const t = useTranslations("expenses");
  const tc = useTranslations("common");
  const { monthIn } = useMonthFormat();
  const { fmt, currency } = useMoney();
  const { showToast } = useToast();
  const { expenses, recurring } = zd;
  const categories = useCategories();

  const months = allMonthsSorted([], expenses, recurring, currentMonth)
    .reverse()
    .filter((m) => expensesForMonth(expenses, recurring, m).length > 0);

  const monthTotal = (m: string) => expensesForMonth(expenses, recurring, m).reduce((s, x) => s + baseAmount(x), 0);
  const years = [...new Set(months.map((m) => m.slice(0, 4)))].sort();
  const yearTotals = (year: string) => {
    const inYear = months.filter((m) => m.startsWith(year));
    return { total: inYear.reduce((s, m) => s + monthTotal(m), 0), months: inYear.length };
  };

  const { active, ended } = splitTemplates(recurring, currentMonth);
  const toRow = (r: RecurringExpense): RecurringRowData => ({
    id: r.id,
    icon: resolveIcon(r.icon, categories.icon(r.category_id)),
    title: r.desc || categories.name(r.category_id),
    badge: categories.name(r.category_id),
    amount: `−${fmt(r.amount, 2, r.currency)}`,
    template: r,
  });

  async function handleDeleteExpense(id: string) {
    const removed = await zd.deleteExpense(id);
    if (!removed) return;
    showToast(t("deleted", { label: removed.desc || categories.name(removed.category_id) }), () => zd.restoreExpense(removed));
  }

  async function handleDisableNow(id: string) {
    const tpl = recurring.find((r) => r.id === id);
    const result = await zd.recurringExpenseOps.disableFrom(id, currentMonth);
    if (!tpl || !result) return;
    const label = tpl.desc || categories.name(tpl.category_id);
    showToast(
      result.deleted ? t("recurringDeleted", { label }) : t("recurringDisabled", { label, month: monthIn(currentMonth) }),
      result.undo
    );
  }

  return (
    <div className="pb-2">
      <YearSummary
        years={years}
        initialYear={currentMonth.slice(0, 4)}
        tone="critical"
        label={(year) => t("yearTotal", { year })}
        totalsFor={yearTotals}
      />
      <RecurringSection
        title={t("recurringTitle")}
        tone="critical"
        active={active.map(toRow)}
        ended={ended.map(toRow)}
        onEdit={(id) => {
          const tpl = recurring.find((r) => r.id === id);
          if (tpl) onEditRecurring(tpl);
        }}
        onDisable={handleDisableNow}
      />

      <div className="text-[13px] font-semibold text-ink-muted uppercase tracking-wide mb-2.5">{t("monthlyTitle")}</div>
      {months.length === 0 ? (
        <div className="text-center py-10 px-5 text-ink-muted text-[13px]">{t("empty")}</div>
      ) : (
        months.map((m) => {
          const items = expensesForMonth(expenses, recurring, m).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
          return (
            <MonthGroup key={m} month={m} total={monthTotal(m)}>
              {items.map((x) => {
                const isRecurring = "recurring" in x;
                return (
                  <div key={x.id} className="bg-surface-2 border border-border rounded-md p-3 flex items-center gap-3">
                    <span className="w-9 h-9 rounded-md bg-critical-soft text-critical flex items-center justify-center shrink-0 text-[17px]">
                      {resolveIcon(x.icon, categories.icon(x.category_id))}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-semibold truncate">{x.desc || categories.name(x.category_id)}</div>
                      <div className="text-xs text-ink-muted mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <Badge>{categories.name(x.category_id)}</Badge>
                        {isRecurring && (
                          <Badge>
                            <RecurringIcon size={9} /> {tc("recurring")}
                          </Badge>
                        )}
                        <span>{x.date}</span>
                      </div>
                    </div>
                    <div className="tabular-nums text-right shrink-0">
                      <div className="font-bold text-sm text-critical">−{fmt(x.amount, 2, x.currency)}</div>
                      {x.currency !== currency && <div className="text-[11px] text-ink-muted">≈ {fmt(baseAmount(x))}</div>}
                    </div>
                    {isRecurring ? (
                      <IconButton label={t("recurringMenu")} onClick={() => onOpenRecurringMenu(x.templateId, x.month)} danger>
                        <TrashIcon />
                      </IconButton>
                    ) : (
                      <>
                        <IconButton label={tc("edit")} onClick={() => onEditExpense(x)}>
                          <PencilIcon />
                        </IconButton>
                        <IconButton label={tc("delete")} onClick={() => handleDeleteExpense(x.id)} danger>
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
