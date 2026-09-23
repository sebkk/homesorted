"use client";

import { useTranslations } from "next-intl";

export type FinanceTab = "dashboard" | "incomes" | "expenses" | "savings";

const TABS: { id: FinanceTab; icon: React.ReactNode }[] = [
  {
    id: "dashboard",
    icon: (
      <>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </>
    ),
  },
  {
    id: "incomes",
    icon: (
      <>
        <path d="M3 17l6-6 4 4 8-8" />
        <path d="M15 7h6v6" />
      </>
    ),
  },
  {
    id: "expenses",
    icon: (
      <>
        <path d="M6 7h12l-1 13H7L6 7Z" />
        <path d="M9 7a3 3 0 0 1 6 0" />
      </>
    ),
  },
  {
    id: "savings",
    icon: (
      <>
        <ellipse cx="12" cy="7" rx="8" ry="3" />
        <path d="M4 7v6c0 1.66 3.58 3 8 3s8-1.34 8-3V7" />
        <path d="M4 13v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
      </>
    ),
  },
];

export function FinanceTabbar({ active, onChange }: { active: FinanceTab; onChange: (tab: FinanceTab) => void }) {
  const t = useTranslations("tabs");
  const activeIndex = TABS.findIndex((tab) => tab.id === active);
  return (
    <nav
      className="absolute left-4 right-4 z-20 bg-nav-bg glass border border-border rounded-xl flex p-[7px_8px] shadow-glass"
      style={{ bottom: "calc(14px + env(safe-area-inset-bottom, 0px))" }}
    >
      <div
        aria-hidden
        className="absolute rounded-md bg-accent-soft transition-[left] duration-200 ease-out"
        style={{
          top: "7px",
          bottom: "7px",
          left: `calc(8px + (100% - 16px) * ${activeIndex} / ${TABS.length})`,
          width: `calc((100% - 16px) / ${TABS.length})`,
        }}
      />
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`relative flex-1 flex flex-col items-center gap-[3px] border-none font-sans text-[10.5px] font-semibold py-1.5 px-1 rounded-md transition-colors duration-200 ${
              isActive ? "text-accent font-bold" : "text-ink bg-transparent"
            }`}
          >
            <svg
              width={21}
              height={21}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={isActive ? 2.3 : 2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {tab.icon}
            </svg>
            <span>{t(tab.id)}</span>
          </button>
        );
      })}
    </nav>
  );
}
