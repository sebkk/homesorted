"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { FormProvider, useForm, useFormContext, useWatch } from "react-hook-form";
import { useIntlLocale, useMonthFormat, usePeriodRange } from "@/i18n/useFormat";
import { CURRENCIES, currencyName } from "@/lib/currencies";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/ui/NavigationProgress";
import { createClient } from "@/lib/supabase/client";
import { createZone, deleteZone, togglePinZone, updateZone } from "@/lib/actions";
import { currentMonthStr, currentPeriod, nextMonth, type MonthPeriod } from "@/lib/finance";
import { MAX_ZONE_NAME, ZONE_COLORS, Zone, zoneColorVar } from "@/lib/types";
import { Sheet, SheetHeader, Field, fieldAria } from "@/components/ui/Sheet";
import { Banner } from "@/components/ui/FormField";
import { useToast } from "@/components/ui/Toast";
import { PencilIcon } from "@/components/finance/icons";
import { Skeleton, SkeletonScreen } from "@/components/ui/Skeleton";

const inputClass =
  "text-[14.5px] font-medium text-ink bg-surface-2 border border-border rounded-md px-3 py-2.5 outline-none focus:border-accent aria-[invalid=true]:border-critical";
const primaryButton = "font-bold text-[14.5px] text-accent-ink bg-accent rounded-md py-3 mb-1 disabled:opacity-60";

type SheetState = { kind: "create" } | { kind: "edit"; zone: Zone } | null;

export default function ZonesPage() {
  const t = useTranslations("zones");
  const tf = useTranslations("finance");
  const supabase = createClient();
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState<SheetState>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("zones")
      .select("*")
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (cancelled) return;
        setZones((data as Zone[]) ?? []);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePin(zone: Zone) {
    setZones((prev) => prev.map((z) => (z.id === zone.id ? { ...z, pinned: !z.pinned } : z)));
    await togglePinZone(zone.id, !zone.pinned);
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="sticky top-0 z-20 bg-surface glass flex items-center justify-between border-b border-border px-5"
        style={{ paddingTop: "calc(14px + env(safe-area-inset-top, 0px))", paddingBottom: "12px" }}>
        <Link
          href="/launcher"
          aria-label={tf("backToLauncher")}
          className="w-8 h-8 rounded-md border border-border bg-surface-2 text-ink-muted flex items-center justify-center"
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <span className="font-bold text-[16px] tracking-tight">{t("title")}</span>
        <button
          type="button"
          aria-label={t("new")}
          onClick={() => setSheet({ kind: "create" })}
          className="w-8 h-8 rounded-md border border-border bg-surface-2 text-ink-muted flex items-center justify-center"
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-5" style={{ paddingTop: "22px", paddingBottom: "28px" }}>
        <div className="text-[13px] text-ink-muted mb-[18px]">
          {t("intro")}
        </div>

        {!loading && zones.length === 0 && (
          <div className="text-center py-10 px-5 text-ink-muted text-[13px]">
            {t("empty")}
          </div>
        )}

        {loading && (
          <SkeletonScreen label={tf("loading")} className="flex flex-col gap-2">
            {[0, 1].map((i) => (
              <div key={i} className="bg-surface-2 border border-border rounded-lg p-3 flex items-center gap-3">
                <Skeleton className="w-9 h-9 shrink-0" />
                <Skeleton className="h-3.5 w-2/5" />
                <div className="flex-1" />
                <Skeleton className="w-8 h-8 shrink-0" />
                <Skeleton className="w-8 h-8 shrink-0" />
              </div>
            ))}
          </SkeletonScreen>
        )}

        <div className="flex flex-col gap-2">
          {zones.map((zone) => (
            <div key={zone.id} className="bg-surface-2 border border-border rounded-lg p-3 flex items-center gap-2">
              <Link href={`/finance/${zone.id}`} className="flex items-center gap-3 flex-1 min-w-0 rounded-md -m-1 p-1">
                <span
                  className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
                  style={{ background: `color-mix(in srgb, ${zoneColorVar(zone.color)} 16%, transparent)`, color: zoneColorVar(zone.color) }}
                >
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 17l6-6 4 4 8-8" />
                    <path d="M15 7h6v6" />
                  </svg>
                </span>
                <span className="text-[13.5px] font-semibold truncate">{zone.name}</span>
                <span className="text-[11px] font-semibold text-ink-muted shrink-0">{zone.currency}</span>
              </Link>
              <button
                type="button"
                onClick={() => setSheet({ kind: "edit", zone })}
                aria-label={t("editZone", { name: zone.name })}
                className="shrink-0 w-8 h-8 rounded-md border border-border bg-surface text-ink-faint flex items-center justify-center"
              >
                <PencilIcon />
              </button>
              <button
                type="button"
                onClick={() => handlePin(zone)}
                aria-label={zone.pinned ? t("unpin") : t("pin")}
                className={`shrink-0 w-8 h-8 rounded-md border flex items-center justify-center ${
                  zone.pinned ? "bg-accent-soft border-transparent text-accent" : "bg-surface border-border text-ink-faint"
                }`}
              >
                <svg width={15} height={15} viewBox="0 0 24 24" fill={zone.pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l1.5 5.5L19 9l-4.5 3.5L16 18l-4-3-4 3 1.5-5.5L5 9l5.5-1.5L12 2Z" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      <Sheet open={sheet !== null} onClose={() => setSheet(null)}>
        {sheet?.kind === "create" && <CreateZoneForm defaultColor={(zones.length % ZONE_COLORS) + 1} onClose={() => setSheet(null)} />}
        {sheet?.kind === "edit" && (
          <EditZoneForm
            key={sheet.zone.id}
            zone={sheet.zone}
            onClose={() => setSheet(null)}
            onSaved={(patch) => setZones((prev) => prev.map((z) => (z.id === sheet.zone.id ? { ...z, ...patch } : z)))}
            onDeleted={() => setZones((prev) => prev.filter((z) => z.id !== sheet.zone.id))}
          />
        )}
      </Sheet>
    </div>
  );
}

function useNameRules() {
  const t = useTranslations("zones");
  return {
    validate: (v: string) => v.trim().length > 0 || t("validation.nameRequired"),
    maxLength: { value: MAX_ZONE_NAME, message: t("validation.nameTooLong", { max: MAX_ZONE_NAME }) },
  };
}

interface ZoneFormValues {
  name: string;
  color: string;
  monthStartDay: string;
  monthLabel: "start" | "end";
}

/** Form values → the settings the zone server actions take. */
function toSettings(v: ZoneFormValues) {
  return { name: v.name.trim(), color: Number(v.color), monthStartDay: Number(v.monthStartDay) || 1, monthLabel: v.monthLabel };
}

function CreateZoneForm({ defaultColor, onClose }: { defaultColor: number; onClose: () => void }) {
  const t = useTranslations("zones");
  const intlLocale = useIntlLocale();
  const router = useRouter();
  const nameRules = useNameRules();
  const [serverError, setServerError] = useState(false);
  const form = useForm<ZoneFormValues & { currency: string }>({
    mode: "onTouched",
    defaultValues: { name: "", currency: "PLN", color: String(defaultColor), monthStartDay: "1", monthLabel: "start" },
  });
  const { register, handleSubmit, formState } = form;
  const error = formState.errors.name;

  async function onSubmit(v: ZoneFormValues & { currency: string }) {
    setServerError(false);
    const { data, error } = await createZone({ ...toSettings(v), currency: v.currency });
    if (error || !data) {
      setServerError(true);
      return;
    }
    onClose();
    startNavigationProgress();
    router.push(`/finance/${data.id}`);
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
        <SheetHeader title={t("new")} onClose={onClose} />
        <Field label={t("name")} htmlFor="zoneName" error={error?.message}>
          <input id="zoneName" type="text" placeholder={t("namePlaceholder")} {...fieldAria("zoneName", error)} {...register("name", nameRules)} className={inputClass} />
        </Field>
        <Field label={t("currency")} htmlFor="zoneCurrency" hint={t("currencyHint")}>
          <select id="zoneCurrency" {...register("currency")} className={inputClass}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c} — {currencyName(c, intlLocale)}
              </option>
            ))}
          </select>
        </Field>
        <ZoneColorField />
        <ZonePeriodFields />
        {serverError && <Banner tone="critical">{t("errors.saveFailed")}</Banner>}
        <button type="submit" disabled={formState.isSubmitting} className={primaryButton}>
          {formState.isSubmitting ? t("creating") : t("create")}
        </button>
      </form>
    </FormProvider>
  );
}

function ZoneColorField() {
  const t = useTranslations("zones");
  const { register } = useFormContext<ZoneFormValues>();
  return (
    <fieldset>
      <legend className="text-xs font-semibold text-ink-muted mb-1.5">{t("color")}</legend>
      <div className="flex flex-wrap gap-2.5">
        {Array.from({ length: ZONE_COLORS }, (_, i) => i + 1).map((c) => (
          <label
            key={c}
            className="relative w-8 h-8 rounded-full flex items-center justify-center cursor-pointer text-white has-[:checked]:ring-2 has-[:checked]:ring-ink has-[:checked]:ring-offset-2 has-[:checked]:ring-offset-sheet-bg has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-accent"
            style={{ background: zoneColorVar(c) }}
          >
            <input type="radio" value={c} {...register("color")} aria-label={t(`colors.${c}`)} className="peer sr-only" />
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="hidden peer-checked:block" aria-hidden>
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Month start day, how a two-month period is named, and a preview of the current one. */
function ZonePeriodFields() {
  const t = useTranslations("zones");
  const { month: monthName } = useMonthFormat();
  const rangeOf = usePeriodRange();
  const { register, control } = useFormContext<ZoneFormValues>();
  const [startDay, label] = useWatch({ control, name: ["monthStartDay", "monthLabel"] });
  const preview: MonthPeriod = { startDay: Number(startDay) || 1, label };
  const previewKey = currentPeriod(preview);
  // A sample period starting this calendar month, to show how each naming option reads.
  const sampleFirst = currentMonthStr();
  const sampleRange = rangeOf(sampleFirst, { startDay: preview.startDay, label: "start" }) ?? "";

  return (
    <>
      <Field label={t("period.startDay")} htmlFor="zoneStartDay" hint={t("period.startDayHint")}>
        <select id="zoneStartDay" {...register("monthStartDay")} className={inputClass}>
          {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {d === 1 ? t("period.day1") : t("period.dayN", { day: d })}
            </option>
          ))}
        </select>
      </Field>
      {preview.startDay > 1 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs font-semibold text-ink-muted mb-1.5">{t("period.label")}</legend>
          {(["start", "end"] as const).map((l) => (
            <label key={l} className="flex items-start gap-2.5 text-[13px]" htmlFor={`zoneLabel-${l}`}>
              <input id={`zoneLabel-${l}`} type="radio" value={l} {...register("monthLabel")} className="mt-0.5 accent-accent" />
              <span>
                {t(l === "start" ? "period.labelStart" : "period.labelEnd", {
                  range: sampleRange,
                  month: monthName(l === "start" ? sampleFirst : nextMonth(sampleFirst)),
                })}
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <div className="text-[12px] text-ink-muted bg-surface-2 border border-border rounded-md px-3 py-2.5">
        {preview.startDay > 1
          ? t("period.preview", { month: monthName(previewKey), range: rangeOf(previewKey, preview) ?? "" })
          : t("period.previewCalendar")}
      </div>
    </>
  );
}

function EditZoneForm({
  zone,
  onClose,
  onSaved,
  onDeleted,
}: {
  zone: Zone;
  onClose: () => void;
  onSaved: (patch: Pick<Zone, "name" | "color" | "month_start_day" | "month_label">) => void;
  onDeleted: () => void;
}) {
  const t = useTranslations("zones");
  const { showToast } = useToast();
  const nameRules = useNameRules();
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const form = useForm<ZoneFormValues>({
    mode: "onTouched",
    defaultValues: {
      name: zone.name,
      color: String(zone.color),
      monthStartDay: String(zone.month_start_day ?? 1),
      monthLabel: zone.month_label ?? "start",
    },
  });
  const { register, handleSubmit, formState } = form;
  const error = formState.errors.name;

  async function onSubmit(v: ZoneFormValues) {
    setServerError(null);
    const settings = toSettings(v);
    const { error } = await updateZone(zone.id, settings);
    if (error) {
      setServerError(t("errors.saveFailed"));
      return;
    }
    onSaved({ name: settings.name, color: settings.color, month_start_day: settings.monthStartDay, month_label: settings.monthLabel });
    onClose();
    showToast(t("saved", { name: settings.name }));
  }

  async function handleDelete() {
    setServerError(null);
    setDeleting(true);
    const { error } = await deleteZone(zone.id);
    setDeleting(false);
    if (error) {
      setServerError(t("errors.deleteFailed"));
      return;
    }
    onDeleted();
    onClose();
    showToast(t("deleted", { name: zone.name }));
  }

  return (
    <div className="flex flex-col gap-3">
      <FormProvider {...form}>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
          <SheetHeader title={t("editTitle")} onClose={onClose} />
          <Field label={t("name")} htmlFor="editZoneName" error={error?.message}>
            <input id="editZoneName" type="text" {...fieldAria("editZoneName", error)} {...register("name", nameRules)} className={inputClass} />
          </Field>
          <div className="text-[11.5px] text-ink-faint -mt-1">{t("currencyLocked", { currency: zone.currency })}</div>
          <ZoneColorField />
          <ZonePeriodFields />

          <button type="submit" disabled={formState.isSubmitting || !formState.isDirty} className={primaryButton}>
            {formState.isSubmitting ? t("saving") : t("save")}
          </button>
        </form>
      </FormProvider>

      {serverError && <Banner tone="critical">{serverError}</Banner>}

      <div className="border-t border-border pt-3 flex flex-col gap-2.5 mb-1">
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="font-semibold text-[13px] text-critical bg-critical-soft border-none rounded-md py-2.5"
          >
            {t("delete")}
          </button>
        ) : (
          <>
            <div role="alert" className="text-[12.5px] text-critical leading-relaxed bg-critical-soft rounded-md px-3 py-2.5">
              {t.rich("deleteWarning", { name: zone.name, b: (chunks) => <b className="font-semibold">{chunks}</b> })}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="flex-1 font-semibold text-[13px] text-ink-muted bg-surface-2 border border-border rounded-md py-2.5"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 font-bold text-[13px] text-white bg-critical border-none rounded-md py-2.5 disabled:opacity-60"
              >
                {deleting ? t("deleting") : t("confirmDelete")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
