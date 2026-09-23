"use client";

import { useState } from "react";
import { useMoney } from "@/components/finance/MoneyContext";

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

const SIZE = 132;
const R = 52;
const STROKE = 18;
const C = 2 * Math.PI * R;
const GAP = 2.5; // surface gap between segments

/** Part-to-whole at a glance (<= 6 segments, fixed color order). Hover/focus
 * shows the segment's value in the center instead of a floating tooltip, so
 * nothing can overflow the screen; the legend beside it carries identity. */
export function Donut({ segments, centerCaption }: { segments: DonutSegment[]; centerCaption: string }) {
  const { fmt } = useMoney();
  const [active, setActive] = useState<string | null>(null);
  const total = segments.reduce((s, x) => s + x.value, 0);
  const hovered = segments.find((s) => s.key === active);

  const arcs = segments.map((s, i) => ({
    ...s,
    len: Math.max((s.value / total) * C - GAP, 0.5),
    offset: (segments.slice(0, i).reduce((sum, x) => sum + x.value, 0) / total) * C,
  }));

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} onMouseLeave={() => setActive(null)}>
          {arcs.map((a) => (
            <circle
              key={a.key}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              stroke={a.color}
              strokeWidth={STROKE}
              strokeDasharray={`${a.len} ${C - a.len}`}
              strokeDashoffset={-a.offset}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              opacity={active && active !== a.key ? 0.3 : 1}
              className="cursor-pointer outline-none transition-opacity duration-150"
              tabIndex={0}
              role="img"
              aria-label={`${a.label}: ${fmt(a.value)} (${Math.round((a.value / total) * 100)}%)`}
              onMouseEnter={() => setActive(a.key)}
              onFocus={() => setActive(a.key)}
              onBlur={() => setActive(null)}
              onClick={() => setActive((k) => (k === a.key ? null : a.key))}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-5">
          <div className="text-[10.5px] text-ink-muted font-medium leading-tight truncate max-w-full">
            {hovered ? hovered.label : centerCaption}
          </div>
          <div className="tabular-nums text-[14px] font-bold leading-tight mt-0.5">{fmt(hovered ? hovered.value : total)}</div>
          {hovered && (
            <div className="tabular-nums text-[10.5px] text-ink-muted">{Math.round((hovered.value / total) * 100)}%</div>
          )}
        </div>
      </div>
      <ul className="flex-1 min-w-0 flex flex-col gap-1.5">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-[12.5px]">
            <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: s.color }} />
            <span className="flex-1 min-w-0 truncate">{s.label}</span>
            <span className="tabular-nums text-ink-muted shrink-0">{Math.round((s.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
