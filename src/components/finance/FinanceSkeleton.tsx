"use client";

import { useTranslations } from "next-intl";
import { Skeleton, SkeletonScreen } from "@/components/ui/Skeleton";
import type { FinanceTab } from "@/components/finance/FinanceTabbar";

// Placeholders shaped like each tab (same cards, spacing and row heights), so
// nothing jumps when the zone's data arrives.

const card = "bg-surface-2 border border-border";

function Row() {
  return (
    <div className={`${card} rounded-md p-3 flex items-center gap-3`}>
      <Skeleton className="w-9 h-9 shrink-0" />
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <Skeleton className="h-4 w-16 shrink-0" />
    </div>
  );
}

function SectionTitle({ width = "w-40", className = "" }: { width?: string; className?: string }) {
  return <Skeleton className={`h-3.5 ${width} mb-2.5 ${className}`} />;
}

function Hero({ lines = 3 }: { lines?: number }) {
  return (
    <div className={`${card} mt-3.5 p-5 rounded-xl shadow-glass flex flex-col gap-3`}>
      <Skeleton className="h-3.5 w-1/2" />
      <Skeleton className="h-9 w-3/5" />
      {lines > 2 && <Skeleton className="h-5 w-24 rounded-full" />}
      <Skeleton className="h-3 w-4/5" />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <Hero />
      <div className="flex gap-2.5 mt-3">
        <Skeleton className="flex-1 h-[42px]" />
        <Skeleton className="flex-1 h-[42px]" />
      </div>
      <div className="grid grid-cols-2 gap-2.5 mt-3.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`${card} rounded-md py-3 px-2.5 flex flex-col gap-2`}>
            <Skeleton className="h-3 w-3/5" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ))}
      </div>
      <SectionTitle width="w-56" className="mt-[22px]" />
      <div className={`${card} rounded-xl p-3.5 h-[210px] flex items-end gap-4 justify-around`}>
        {/* column heights (%) loosely like a real few months */}
        {[30, 30, 30, 85, 70, 90].map((h, i) => (
          <div key={i} className="w-7" style={{ height: `${h}%` }}>
            <Skeleton className="w-full h-full" />
          </div>
        ))}
      </div>
    </>
  );
}

function ListSkeleton() {
  return (
    <>
      <div className={`${card} mt-3.5 mb-[22px] p-4 rounded-xl shadow-glass flex flex-col gap-2.5`}>
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-3 w-3/5" />
      </div>
      <SectionTitle />
      <div className="flex flex-col gap-2 mb-[22px]">
        <Row />
        <Row />
      </div>
      <SectionTitle width="w-32" />
      <div className="flex justify-between items-center pb-2">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3.5 w-20" />
      </div>
      <div className="flex flex-col gap-2">
        <Row />
        <Row />
        <Row />
        <Row />
      </div>
    </>
  );
}

function SavingsSkeleton() {
  return (
    <>
      <Hero lines={2} />
      <SectionTitle width="w-24" className="mt-[22px]" />
      <div className="flex flex-col gap-2">
        <Row />
        <Row />
        <Row />
      </div>
    </>
  );
}

export function FinanceSkeleton({ tab }: { tab: FinanceTab }) {
  const t = useTranslations("finance");
  return (
    <SkeletonScreen label={t("loading")} className="pb-2">
      {tab === "dashboard" ? <DashboardSkeleton /> : tab === "savings" ? <SavingsSkeleton /> : <ListSkeleton />}
    </SkeletonScreen>
  );
}

/** Neutral page placeholder for when the page itself isn't known yet
 * (e.g. while checking whether the account's data needs unlocking). */
export function PageSkeleton() {
  const t = useTranslations("finance");
  return (
    <SkeletonScreen label={t("loading")} className="flex-1 flex flex-col min-h-0">
      <div
        className="flex items-center gap-2.5 border-b border-border px-5"
        style={{ paddingTop: "calc(14px + env(safe-area-inset-top, 0px))", paddingBottom: "12px" }}
      >
        <Skeleton className="w-[26px] h-[26px] rounded-[7px]" />
        <Skeleton className="h-4 w-36" />
      </div>
      <div className="px-5 pt-4 flex flex-col gap-3">
        <Hero />
        <Row />
        <Row />
        <Row />
      </div>
    </SkeletonScreen>
  );
}
