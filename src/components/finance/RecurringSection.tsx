"use client";

import { useState } from "react";
import { monthLabelGenitive, prevMonth } from "@/lib/finance";
import { RecurringTemplate } from "@/lib/types";
import { Collapsible } from "@/components/ui/Collapsible";
import { TrashIcon, RecurringIcon, PencilIcon, ChevronIcon } from "@/components/finance/icons";
import { IconButton } from "@/components/finance/IconButton";

const PREVIEW_COUNT = 2;

export interface RecurringRowData {
  id: string;
  icon: string;
  title: string;
  badge: string;
  amount: string;
  template: RecurringTemplate;
}

export function recurringRange(t: Pick<RecurringTemplate, "start_month" | "end_month">): string {
  const from = `od ${monthLabelGenitive(t.start_month)}`;
  if (!t.end_month) return `co miesiąc, ${from}`;
  if (t.end_month <= t.start_month) return "nie obowiązywał w żadnym miesiącu";
  return `co miesiąc, ${from} do ${monthLabelGenitive(prevMonth(t.end_month))}`;
}

/** Splits templates into active (newest first) and ended as of `currentMonth`. */
export function splitTemplates<T extends RecurringTemplate>(templates: T[], currentMonth: string) {
  const active = templates
    .filter((r) => !r.end_month || currentMonth < r.end_month)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
  const ended = templates
    .filter((r) => r.end_month && r.end_month <= currentMonth)
    .sort((a, b) => (a.end_month! < b.end_month! ? 1 : a.end_month! > b.end_month! ? -1 : 0));
  return { active, ended };
}

export function RecurringSection({
  title,
  tone,
  active,
  ended,
  onEdit,
  onDisable,
}: {
  title: string;
  tone: "good" | "critical";
  active: RecurringRowData[];
  ended: RecurringRowData[];
  onEdit: (id: string) => void;
  onDisable: (id: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [showEnded, setShowEnded] = useState(false);
  if (active.length === 0 && ended.length === 0) return null;

  const preview = active.slice(0, PREVIEW_COUNT);
  const extra = active.slice(PREVIEW_COUNT);
  const row = (r: RecurringRowData, muted = false) => (
    <Row key={r.id} r={r} tone={tone} muted={muted} onEdit={() => onEdit(r.id)} onDisable={muted ? undefined : () => onDisable(r.id)} />
  );

  return (
    <div className="flex flex-col items-stretch mb-[22px]">
      <div className="text-[13px] font-semibold text-ink-muted uppercase tracking-wide mb-2.5">{title}</div>
      {active.length === 0 && <div className="text-[12.5px] text-ink-muted">Brak aktywnych pozycji.</div>}
      <div className="flex flex-col gap-2">{preview.map((r) => row(r))}</div>
      {extra.length > 0 && (
        <>
          <Collapsible open={showAll}>
            <div className="flex flex-col gap-2 pt-2">{extra.map((r) => row(r))}</div>
          </Collapsible>
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="self-start flex items-center gap-1 text-[12.5px] font-semibold text-accent bg-transparent border-none mt-2"
          >
            <ChevronIcon open={showAll} size={13} />
            {showAll ? "Pokaż mniej" : `Pokaż więcej (${extra.length})`}
          </button>
        </>
      )}
      {ended.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowEnded((v) => !v)}
            className="self-start flex items-center gap-1 text-[12.5px] font-semibold text-ink-muted bg-transparent border-none mt-2"
          >
            <ChevronIcon open={showEnded} size={13} />
            Zakończone ({ended.length})
          </button>
          <Collapsible open={showEnded}>
            <div className="flex flex-col gap-2 pt-2">{ended.map((r) => row(r, true))}</div>
          </Collapsible>
        </>
      )}
    </div>
  );
}

function Row({
  r,
  tone,
  muted,
  onEdit,
  onDisable,
}: {
  r: RecurringRowData;
  tone: "good" | "critical";
  muted: boolean;
  onEdit: () => void;
  onDisable?: () => void;
}) {
  const soft = tone === "good" ? "bg-good-soft text-good" : "bg-critical-soft text-critical";
  const text = tone === "good" ? "text-good" : "text-critical";
  return (
    <div className={`bg-surface-2 border border-border rounded-md p-3 flex items-center gap-3 ${muted ? "opacity-60" : ""}`}>
      <span className={`relative w-9 h-9 rounded-md flex items-center justify-center shrink-0 text-[17px] ${soft}`}>
        {r.icon}
        <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-surface-2 border border-border flex items-center justify-center ${text}`}>
          <RecurringIcon />
        </span>
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-semibold truncate">{r.title}</div>
        <div className="text-xs text-ink-muted mt-0.5 flex items-center gap-1.5 flex-wrap">
          <Badge>{r.badge}</Badge>
          <span>{recurringRange(r.template)}</span>
        </div>
      </div>
      <div className={`tabular-nums font-bold text-sm shrink-0 ${text}`}>{r.amount}</div>
      <IconButton label="Edytuj pozycję stałą" onClick={onEdit}>
        <PencilIcon />
      </IconButton>
      {onDisable && (
        <IconButton label="Wyłącz od teraz" onClick={onDisable} danger>
          <TrashIcon />
        </IconButton>
      )}
    </div>
  );
}

export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-surface-3 text-ink-muted">
      {children}
    </span>
  );
}
