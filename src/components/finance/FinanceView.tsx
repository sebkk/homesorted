"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useZoneData } from "@/lib/useZoneData";
import { currentPeriod, type MonthPeriod } from "@/lib/finance";
import { FinanceTabbar, FinanceTab } from "@/components/finance/FinanceTabbar";
import { Fab } from "@/components/ui/Fab";
import { DashboardTab } from "@/components/finance/DashboardTab";
import { IncomesTab } from "@/components/finance/IncomesTab";
import { ExpensesTab } from "@/components/finance/ExpensesTab";
import { SavingsTab } from "@/components/finance/SavingsTab";
import { FinanceSheets, SheetState } from "@/components/finance/FinanceSheets";
import { MoneyProvider } from "@/components/finance/MoneyContext";
import { FinanceSkeleton } from "@/components/finance/FinanceSkeleton";
import { Logo } from "@/components/ui/Logo";
import { useEncryption } from "@/components/encryption/EncryptionContext";
import { EncryptionLockButton } from "@/components/encryption/EncryptionLockButton";

export function FinanceView({
  zoneId,
  zoneName,
  zoneCurrency,
  period,
}: {
  zoneId: string;
  zoneName: string;
  zoneCurrency: string;
  period: MonthPeriod;
}) {
  const t = useTranslations("finance");
  const [tab, setTab] = useState<FinanceTab>("dashboard");
  const [sheet, setSheet] = useState<SheetState>(null);
  // The zone's current "month" — with a custom start day it may differ from
  // the calendar month (see MonthPeriod).
  const currentMonth = currentPeriod(period);
  const { dek } = useEncryption();
  const zd = useZoneData(zoneId, zoneCurrency, currentMonth, dek, period);

  return (
    <MoneyProvider currency={zoneCurrency}>
    <div className="flex-1 flex flex-col min-h-0 relative">
      <header
        className="sticky top-0 z-20 bg-surface glass flex items-center justify-between border-b border-border px-5"
        style={{ paddingTop: "calc(14px + env(safe-area-inset-top, 0px))", paddingBottom: "12px" }}
      >
        <div className="flex items-center gap-2.5">
          <Logo size={26} />
          <span className="font-bold text-[16px] tracking-tight">{zoneName}</span>
          <span className="text-[11px] font-semibold text-ink-muted bg-surface-2 border border-border rounded-full px-2 py-0.5">{zoneCurrency}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <EncryptionLockButton />
          <Link
            href="/launcher"
            aria-label={t("backToLauncher")}
            className="w-8 h-8 rounded-md border border-border bg-surface-2 text-ink-muted flex items-center justify-center"
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11l9-8 9 8" />
              <path d="M5 10v10h14V10" />
            </svg>
          </Link>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto px-5 pt-4" style={{ paddingBottom: "calc(112px + env(safe-area-inset-bottom, 0px))" }}>
        {zd.loading ? (
          <FinanceSkeleton tab={tab} />
        ) : tab === "dashboard" ? (
          <DashboardTab
            zd={zd}
            currentMonth={currentMonth}
            onAddIncome={() => setSheet({ type: "income" })}
            onAddExpense={() => setSheet({ type: "expense" })}
            onEditBudgets={() => setSheet({ type: "budgets" })}
            onOpenStats={(month) => setSheet({ type: "monthStats", month })}
          />
        ) : tab === "incomes" ? (
          <IncomesTab
            zd={zd}
            currentMonth={currentMonth}
            onEditIncome={(income) => setSheet({ type: "editIncome", income })}
            onEditRecurring={(recurring) => setSheet({ type: "editRecurringIncome", recurring })}
            onOpenRecurringMenu={(templateId, month) => setSheet({ type: "recurringMenu", kind: "income", templateId, month })}
          />
        ) : tab === "expenses" ? (
          <ExpensesTab
            zd={zd}
            currentMonth={currentMonth}
            onOpenRecurringMenu={(templateId, month) => setSheet({ type: "recurringMenu", kind: "expense", templateId, month })}
            onEditExpense={(expense) => setSheet({ type: "editExpense", expense })}
            onEditRecurring={(recurring) => setSheet({ type: "editRecurring", recurring })}
          />
        ) : (
          <SavingsTab
            zd={zd}
            onEditInitial={() => setSheet({ type: "editInitial" })}
            onEditEntry={(entry) => setSheet({ type: "editSavings", entry })}
          />
        )}
      </main>

      <Fab
        label={tab === "incomes" ? t("addIncome") : tab === "savings" ? t("addSavings") : t("addExpense")}
        onClick={() =>
          setSheet({
            type: tab === "incomes" ? "income" : tab === "savings" ? "savings" : "expense",
          })
        }
      />

      <FinanceTabbar active={tab} onChange={setTab} />

      <FinanceSheets zd={zd} sheet={sheet} onClose={() => setSheet(null)} currentMonth={currentMonth} />
    </div>
    </MoneyProvider>
  );
}
