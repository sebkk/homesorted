"use client";

import { useState } from "react";
import Link from "next/link";
import { useZoneData } from "@/lib/useZoneData";
import { currentMonthStr } from "@/lib/finance";
import { FinanceTabbar, FinanceTab } from "@/components/finance/FinanceTabbar";
import { Fab } from "@/components/ui/Fab";
import { DashboardTab } from "@/components/finance/DashboardTab";
import { IncomesTab } from "@/components/finance/IncomesTab";
import { ExpensesTab } from "@/components/finance/ExpensesTab";
import { SavingsTab } from "@/components/finance/SavingsTab";
import { FinanceSheets, SheetState } from "@/components/finance/FinanceSheets";

export function FinanceView({ zoneId, zoneName }: { zoneId: string; zoneName: string }) {
  const [tab, setTab] = useState<FinanceTab>("dashboard");
  const [sheet, setSheet] = useState<SheetState>(null);
  const zd = useZoneData(zoneId);
  const currentMonth = currentMonthStr();

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      <header
        className="sticky top-0 z-20 bg-surface glass flex items-center justify-between border-b border-border px-5"
        style={{ paddingTop: "calc(14px + env(safe-area-inset-top, 0px))", paddingBottom: "12px" }}
      >
        <div className="flex items-center gap-2.5">
          <svg width={26} height={26} viewBox="0 0 26 26" fill="none">
            <rect x="1" y="1" width="24" height="24" rx="7" fill="var(--accent)" />
            <path d="M7 17.5L10.5 12L13.5 15L19 8" stroke="var(--accent-ink)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="font-bold text-[16px] tracking-tight">{zoneName}</span>
        </div>
        <Link
          href="/launcher"
          aria-label="Wróć do pulpitu"
          className="w-8 h-8 rounded-md border border-border bg-surface-2 text-ink-muted flex items-center justify-center"
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 11l9-8 9 8" />
            <path d="M5 10v10h14V10" />
          </svg>
        </Link>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto px-5 pt-4" style={{ paddingBottom: "112px" }}>
        {zd.loading ? (
          <div className="text-center py-10 text-ink-muted text-[13px]">Wczytywanie…</div>
        ) : tab === "dashboard" ? (
          <DashboardTab
            zd={zd}
            currentMonth={currentMonth}
            onAddIncome={() => setSheet({ type: "income" })}
            onAddExpense={() => setSheet({ type: "expense" })}
          />
        ) : tab === "incomes" ? (
          <IncomesTab zd={zd} />
        ) : tab === "expenses" ? (
          <ExpensesTab zd={zd} currentMonth={currentMonth} onOpenRecurringMenu={(templateId, month) => setSheet({ type: "recurringMenu", templateId, month })} />
        ) : (
          <SavingsTab zd={zd} onEditInitial={() => setSheet({ type: "editInitial" })} />
        )}
      </main>

      <Fab
        onClick={() =>
          setSheet({
            type: tab === "incomes" ? "income" : tab === "savings" ? "savings" : "expense",
          })
        }
      />

      <FinanceTabbar active={tab} onChange={setTab} />

      <FinanceSheets zd={zd} sheet={sheet} onClose={() => setSheet(null)} currentMonth={currentMonth} />
    </div>
  );
}
