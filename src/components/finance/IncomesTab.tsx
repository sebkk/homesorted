"use client";

import { useTranslations } from "next-intl";
import { useIncomeTypeLabel, useMonthFormat } from "@/i18n/useFormat";
import { useZoneData } from "@/lib/useZoneData";
import { useMoney } from "@/components/finance/MoneyContext";
import { allMonthsSorted, grossAmount, grossBase, incomesForMonth, monthIncomeNet, monthIncomeTotal, resolveIcon } from "@/lib/finance";
import { Income, INCOME_TYPE_ICONS, RecurringIncome } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { TrashIcon, PencilIcon, RecurringIcon } from "@/components/finance/icons";
import { Badge, RecurringRowData, RecurringSection, splitTemplates } from "@/components/finance/RecurringSection";
import { MonthGroup } from "@/components/finance/MonthGroup";
import { YearSummary } from "@/components/finance/YearSummary";
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
  const t = useTranslations("incomes");
  const tc = useTranslations("common");
  const typeLabel = useIncomeTypeLabel();
  const { month: monthName, monthIn } = useMonthFormat();
  const { fmt, currency } = useMoney();
  const { showToast } = useToast();
  const { incomes, recurringIncomes } = zd;

  const months = allMonthsSorted(incomes, [], recurringIncomes, currentMonth)
    .reverse()
    .filter((m) => incomesForMonth(incomes, recurringIncomes, m).length > 0);

  const years = [...new Set(months.map((m) => m.slice(0, 4)))].sort();
  const yearTotals = (year: string) => {
    const inYear = months.filter((m) => m.startsWith(year));
    const total = inYear.reduce((s, m) => s + monthIncomeTotal(incomes, recurringIncomes, m), 0);
    const net = inYear.reduce((s, m) => s + monthIncomeNet(incomes, recurringIncomes, m), 0);
    return { total, months: inYear.length, extra: net !== total ? t("net", { amount: fmt(net) }) : undefined };
  };

  const { active, ended } = splitTemplates(recurringIncomes, currentMonth);
  const toRow = (r: RecurringIncome): RecurringRowData => ({
    id: r.id,
    icon: resolveIcon(r.icon, INCOME_TYPE_ICONS[r.type]),
    title: r.desc || typeLabel(r.type),
    badge: r.vat_rate > 0 ? `${typeLabel(r.type)} · ${t("net", { amount: fmt(r.amount, 2, r.currency) })}` : typeLabel(r.type),
    amount: fmt(grossAmount(r), 2, r.currency),
    template: r,
  });

  async function handleDelete(id: string) {
    const removed = await zd.deleteIncome(id);
    if (!removed) return;
    showToast(t("deleted", { label: typeLabel(removed.type), month: monthName(removed.month) }), () => {
      zd.restoreIncome(removed);
    });
  }

  async function handleDisableNow(id: string) {
    const tpl = recurringIncomes.find((r) => r.id === id);
    const result = await zd.recurringIncomeOps.disableFrom(id, currentMonth);
    if (!tpl || !result) return;
    const label = tpl.desc || typeLabel(tpl.type);
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
        tone="good"
        label={(year) => t("yearTotal", { year })}
        totalsFor={yearTotals}
      />
      <RecurringSection
        title={t("recurringTitle")}
        tone="good"
        active={active.map(toRow)}
        ended={ended.map(toRow)}
        onEdit={(id) => {
          const tpl = recurringIncomes.find((r) => r.id === id);
          if (tpl) onEditRecurring(tpl);
        }}
        onDisable={handleDisableNow}
      />

      <div className="text-[13px] font-semibold text-ink-muted uppercase tracking-wide mb-2.5">{t("title")}</div>
      {months.length === 0 ? (
        <div className="text-center py-10 px-5 text-ink-muted text-[13px]">{t("empty")}</div>
      ) : (
        months.map((m) => {
          const items = incomesForMonth(incomes, recurringIncomes, m);
          return (
            <MonthGroup key={m} month={m} total={items.reduce((s, x) => s + grossBase(x), 0)}>
              {items.map((e) => {
                const isRecurring = "recurring" in e;
                const subParts: string[] = [];
                if (e.vat_rate > 0) subParts.push(t("net", { amount: fmt(e.amount, 2, e.currency) }));
                if (e.hours) subParts.push(t(e.vat_rate > 0 ? "hourlyExVat" : "hourly", { hours: e.hours, rate: fmt(e.amount / e.hours, 2, e.currency) }));
                if (e.desc && (e.type !== "b2b" || isRecurring)) subParts.push(e.desc);
                return (
                  <div key={e.id} className="bg-surface-2 border border-border rounded-md p-3 flex items-center gap-3">
                    <span className="w-9 h-9 rounded-md bg-good-soft text-good flex items-center justify-center shrink-0 text-[17px]">
                      {resolveIcon(e.icon, INCOME_TYPE_ICONS[e.type])}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-semibold truncate">{typeLabel(e.type)}</div>
                      {(isRecurring || subParts.length > 0) && (
                        <div className="text-xs text-ink-muted mt-0.5 flex items-center gap-1.5 flex-wrap min-w-0">
                          {isRecurring && (
                            <Badge>
                              <RecurringIcon size={9} /> {tc("recurring")}
                            </Badge>
                          )}
                          {subParts.length > 0 && <span className="truncate">{subParts.join(" · ")}</span>}
                        </div>
                      )}
                    </div>
                    <div className="tabular-nums text-right shrink-0">
                      <div className="font-bold text-sm text-good">{fmt(grossAmount(e), 2, e.currency)}</div>
                      {e.currency !== currency && <div className="text-[11px] text-ink-muted">≈ {fmt(grossBase(e))}</div>}
                    </div>
                    {isRecurring ? (
                      <IconButton label={t("recurringMenu")} onClick={() => onOpenRecurringMenu(e.templateId, e.month)} danger>
                        <TrashIcon />
                      </IconButton>
                    ) : (
                      <>
                        <IconButton label={tc("edit")} onClick={() => onEditIncome(e)}>
                          <PencilIcon />
                        </IconButton>
                        <IconButton label={tc("delete")} onClick={() => handleDelete(e.id)} danger>
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
