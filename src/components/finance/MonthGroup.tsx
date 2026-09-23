"use client";

import { useState } from "react";
import { useMoney } from "@/components/finance/MoneyContext";
import { useMonthFormat } from "@/i18n/useFormat";
import { Collapsible } from "@/components/ui/Collapsible";
import { ChevronIcon } from "@/components/finance/icons";

/** A month heading with its total that collapses its list; expanded by default. */
export function MonthGroup({ month, total, children }: { month: string; total: number; children: React.ReactNode }) {
  const { fmt } = useMoney();
  const { month: monthLabel } = useMonthFormat();
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-[18px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-0.5 pb-2 text-[13px] font-semibold text-ink-muted border-none bg-transparent"
      >
        <span className="flex items-center gap-1.5">
          <ChevronIcon open={open} />
          {monthLabel(month)}
        </span>
        <b className="tabular-nums text-ink font-bold">{fmt(total)}</b>
      </button>
      <Collapsible open={open}>
        <div className="flex flex-col gap-2">{children}</div>
      </Collapsible>
    </div>
  );
}
