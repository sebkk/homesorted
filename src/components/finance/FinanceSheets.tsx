"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FormProvider, useForm, useFormContext, useWatch } from "react-hook-form";
import { useIncomeTypeLabel, useInputNumber, useMonthFormat } from "@/i18n/useFormat";
import { useMoney } from "@/components/finance/MoneyContext";
import { useZoneData } from "@/lib/useZoneData";
import { useCategories } from "@/lib/useCategories";
import { daysInMonth, grossAmount, lastDayOfMonth, nextMonth, pad2, prevMonth, todayStr } from "@/lib/finance";
import { standardWorkHours, workingDaysInMonth } from "@/lib/polishHolidays";
import { Expense, Income, IncomeType, INCOME_TYPE_ICONS, INCOME_TYPES, RecurringExpense, RecurringIncome, SavingsEntry, VAT_RATE } from "@/lib/types";
import { Sheet, SheetHeader, Field, fieldAria } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { MonthStats } from "@/components/finance/MonthStats";
import { AmountWithCurrency, Fx, FxInitial, useFx } from "@/components/finance/FxField";

export type SheetState =
  | { type: "income" }
  | { type: "editIncome"; income: Income }
  | { type: "expense" }
  | { type: "editExpense"; expense: Expense }
  | { type: "editRecurring"; recurring: RecurringExpense }
  | { type: "editRecurringIncome"; recurring: RecurringIncome }
  | { type: "savings" }
  | { type: "editSavings"; entry: SavingsEntry }
  | { type: "editInitial" }
  | { type: "budgets" }
  | { type: "monthStats"; month: string }
  | { type: "recurringMenu"; kind: "expense" | "income"; templateId: string; month: string }
  | null;

const inputClass =
  "text-[14.5px] font-medium text-ink bg-sheet-field-bg border border-border rounded-md px-3 py-2.5 outline-none focus:border-accent aria-[invalid=true]:border-critical tabular-nums";
const checkboxClass = "w-[17px] h-[17px] accent-accent shrink-0";
const formClass = "flex flex-col gap-3";

const MAX_DESC = 200;
const MAX_HOURS = 744; // 31 days × 24 h

/** Form values are strings (what the inputs hold); parse on save. */
const toNumber = (v: string) => parseFloat(String(v).trim().replace(",", ".")) || 0;

type SaveResult = { message: string } | null | undefined;

// Guards against double-submits (a slow response used to invite repeat taps,
// creating duplicate rows) and surfaces save failures instead of silently
// leaving the sheet open.
function useSaver(onClose: () => void) {
  const t = useTranslations("common");
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  async function save(action: () => Promise<SaveResult>, successMessage: string) {
    if (busy) return;
    setBusy(true);
    let error: SaveResult;
    try {
      error = await action();
    } catch (e) {
      error = { message: e instanceof Error ? e.message : t("noConnection") };
    }
    setBusy(false);
    if (error) {
      showToast(t("saveFailed", { message: error.message }));
      return;
    }
    onClose();
    showToast(successMessage);
  }

  return { busy, save };
}

function SaveButton({ busy, label, disabled = false }: { busy: boolean; label: string; disabled?: boolean }) {
  const t = useTranslations("common");
  return (
    <button
      type="submit"
      disabled={busy || disabled}
      className="font-bold text-[14.5px] text-accent-ink bg-accent rounded-md py-3 mb-1 disabled:opacity-60"
    >
      {busy ? t("saving") : label}
    </button>
  );
}

const fxInitial = (x?: FxInitial): FxInitial | undefined =>
  x ? { currency: x.currency, fx_rate: Number(x.fx_rate), fx_date: x.fx_date, fx_table: x.fx_table } : undefined;

/** Checks the NBP rate before saving; returns the fx columns or null after
 * showing why the rate is missing next to the amount. */
function useFxGuard(fx: Fx) {
  const t = useTranslations("fx");
  const [fxError, setFxError] = useState<string | undefined>();
  return {
    fxError: fx.fields ? undefined : fxError,
    requireFx() {
      if (fx.fields) return fx.fields;
      setFxError(t(fx.missingReason ?? "missing"));
      return null;
    },
  };
}

// ---------- month range (recurring templates) ----------
// `endMonth` is the last *inclusive* month shown to the user; the DB stores
// the exclusive cutoff (the month after) — see storedEnd().
interface RangeValues {
  startMonth: string;
  endMonth: string;
}

const rangeDefaults = (start: string, storedEnd: string | null): RangeValues => ({
  startMonth: start,
  endMonth: storedEnd ? prevMonth(storedEnd) : "",
});

const storedEnd = (endMonth: string) => (endMonth ? nextMonth(endMonth) : null);

function MonthRangeFields({
  idPrefix,
  kind,
  currentMonth,
  onStartChange,
}: {
  idPrefix: string;
  kind: "income" | "expense";
  currentMonth: string;
  onStartChange?: (value: string) => void;
}) {
  const t = useTranslations("range");
  const tc = useTranslations("common");
  const tv = useTranslations("validation");
  const { month, monthIn } = useMonthFormat();
  const { register, control, setValue, getValues, formState } = useFormContext<RangeValues>();
  const [startMonth, endMonth] = useWatch({ control, name: ["startMonth", "endMonth"] });
  const startId = `${idPrefix}StartMonth`;
  const endId = `${idPrefix}EndMonth`;
  const { errors } = formState;

  return (
    <>
      <Field
        label={t("from")}
        htmlFor={startId}
        error={errors.startMonth?.message}
        hint={
          !startMonth
            ? undefined
            : startMonth < currentMonth
              ? t("fromPastHint", { month: monthIn(startMonth) })
              : t("fromHint", { kind, month: monthIn(startMonth) })
        }
      >
        <input
          id={startId}
          type="month"
          {...fieldAria(startId, errors.startMonth)}
          {...register("startMonth", {
            required: tv("monthRequired"),
            onChange: (e) => {
              const v = e.target.value;
              // Keep the range valid: a start past the end moves the end along.
              if (v && getValues("endMonth") && getValues("endMonth") < v) setValue("endMonth", v);
              onStartChange?.(v);
            },
          })}
          className={inputClass}
        />
      </Field>
      <Field
        label={t("to")}
        htmlFor={endId}
        error={errors.endMonth?.message}
        hint={endMonth ? t("toHint", { last: month(endMonth), next: monthIn(nextMonth(endMonth)) }) : t("toEmptyHint")}
      >
        <div className="flex flex-row gap-2 items-center">
          <input
            id={endId}
            type="month"
            min={startMonth}
            {...fieldAria(endId, errors.endMonth)}
            {...register("endMonth", {
              validate: (v) => !v || !getValues("startMonth") || v >= getValues("startMonth") || tv("endBeforeStart"),
            })}
            className={inputClass + " flex-1"}
          />
          {endMonth && (
            <button
              type="button"
              onClick={() => setValue("endMonth", "", { shouldValidate: true })}
              className="text-[12.5px] font-semibold text-ink-muted bg-surface-2 rounded-md px-3 py-2.5 whitespace-nowrap"
            >
              {tc("clear")}
            </button>
          )}
        </div>
      </Field>
    </>
  );
}

/** Optional description, shared by every form. */
function DescField({ id, label, placeholder, hint }: { id: string; label: string; placeholder: string; hint?: string }) {
  const tv = useTranslations("validation");
  const { register, formState } = useFormContext<{ desc: string }>();
  const error = formState.errors.desc;
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error?.message}>
      <input
        id={id}
        type="text"
        {...fieldAria(id, error)}
        {...register("desc", { maxLength: { value: MAX_DESC, message: tv("descTooLong") } })}
        className={inputClass}
        placeholder={placeholder}
      />
    </Field>
  );
}

/** Optional emoji overriding the category/type default. */
function IconField({ id, label, hint, placeholder }: { id: string; label: string; hint: string; placeholder: string }) {
  const { register } = useFormContext<{ icon: string }>();
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <input id={id} type="text" {...register("icon")} placeholder={placeholder} maxLength={4} className={inputClass + " text-[18px] text-center w-16"} />
    </Field>
  );
}

export function FinanceSheets({
  zd,
  sheet,
  onClose,
  currentMonth,
}: {
  zd: ReturnType<typeof useZoneData>;
  sheet: SheetState;
  onClose: () => void;
  currentMonth: string;
}) {
  return (
    <Sheet open={sheet !== null} onClose={onClose}>
      {sheet?.type === "income" && <IncomeForm zd={zd} currentMonth={currentMonth} onClose={onClose} />}
      {sheet?.type === "editIncome" && (
        <IncomeForm zd={zd} currentMonth={currentMonth} onClose={onClose} editing={sheet.income} />
      )}
      {sheet?.type === "expense" && <ExpenseForm zd={zd} currentMonth={currentMonth} onClose={onClose} />}
      {sheet?.type === "editExpense" && (
        <ExpenseForm zd={zd} currentMonth={currentMonth} onClose={onClose} editingExpense={sheet.expense} />
      )}
      {sheet?.type === "editRecurring" && (
        <ExpenseForm zd={zd} currentMonth={currentMonth} onClose={onClose} editingRecurring={sheet.recurring} />
      )}
      {sheet?.type === "editRecurringIncome" && (
        <IncomeForm zd={zd} currentMonth={currentMonth} onClose={onClose} editingRecurring={sheet.recurring} />
      )}
      {sheet?.type === "savings" && <SavingsForm zd={zd} onClose={onClose} />}
      {sheet?.type === "editSavings" && <SavingsForm zd={zd} onClose={onClose} editing={sheet.entry} />}
      {sheet?.type === "editInitial" && <EditInitialForm zd={zd} onClose={onClose} />}
      {sheet?.type === "budgets" && <BudgetsForm zd={zd} onClose={onClose} />}
      {sheet?.type === "monthStats" && (
        <MonthStats zd={zd} initialMonth={sheet.month} currentMonth={currentMonth} onClose={onClose} />
      )}
      {sheet?.type === "recurringMenu" && (
        <RecurringMenu zd={zd} kind={sheet.kind} templateId={sheet.templateId} month={sheet.month} onClose={onClose} />
      )}
    </Sheet>
  );
}

// ---------- income ----------
interface IncomeValues extends RangeValues {
  type: IncomeType;
  isRecurring: boolean;
  month: string;
  invoiceDate: string;
  hours: string;
  desc: string;
  amount: string;
  icon: string;
  applyVat: boolean;
}

function IncomeForm({
  zd,
  currentMonth,
  onClose,
  editing,
  editingRecurring,
}: {
  zd: ReturnType<typeof useZoneData>;
  currentMonth: string;
  onClose: () => void;
  editing?: Income;
  editingRecurring?: RecurringIncome;
}) {
  const t = useTranslations("incomeForm");
  const tc = useTranslations("common");
  const tv = useTranslations("validation");
  const typeLabel = useIncomeTypeLabel();
  const { month: monthName } = useMonthFormat();
  const { fmt } = useMoney();
  const { busy, save } = useSaver(onClose);
  const num = useInputNumber();
  const source = editing ?? editingRecurring;
  const isEdit = !!source;
  const form = useForm<IncomeValues>({
    mode: "onTouched",
    defaultValues: {
      type: source?.type ?? "b2b",
      isRecurring: !!editingRecurring,
      month: editing?.month ?? currentMonth,
      invoiceDate: editing?.invoice_date ?? lastDayOfMonth(editing?.month ?? currentMonth),
      hours: source ? num(source.hours) : "",
      desc: source?.desc ?? "",
      amount: source ? num(source.amount) : "",
      icon: source?.icon ?? "",
      applyVat: (source?.vat_rate ?? 0) > 0,
      ...rangeDefaults(editingRecurring?.start_month ?? currentMonth, editingRecurring?.end_month ?? null),
    },
  });
  const { register, control, setValue, getFieldState, handleSubmit, formState } = form;
  const { errors } = formState;
  const [type, isRecurring, month, invoiceDate, startMonth, amount, applyVat] = useWatch({
    control,
    name: ["type", "isRecurring", "month", "invoiceDate", "startMonth", "amount", "applyVat"],
  });
  const hoursMonth = (isRecurring ? startMonth : month) || currentMonth;
  // One-off: rate from the invoice date. Template: from its first month (each
  // month then gets its own rate, see useZoneData).
  const fx = useFx(isRecurring ? (startMonth ? lastDayOfMonth(startMonth) : "") : invoiceDate, fxInitial(source));
  const { fxError, requireFx } = useFxGuard(fx);

  const netAmount = toNumber(amount);
  // Amount is always stored net; VAT is kept as a rate so gross can be shown
  // without ever inflating "na czysto" totals.
  const vatRate = type === "b2b" && applyVat ? VAT_RATE : 0;

  async function onSubmit(v: IncomeValues) {
    const fxFields = requireFx();
    if (!fxFields) return;
    const fields = {
      type: v.type,
      hours: toNumber(v.hours),
      desc: v.desc.trim(),
      icon: v.icon.trim() || null,
      amount: toNumber(v.amount),
      vat_rate: v.type === "b2b" && v.applyVat ? VAT_RATE : 0,
      ...fxFields,
    };
    const templateFields = { ...fields, start_month: v.startMonth, end_month: storedEnd(v.endMonth) };
    const oneOff = { ...fields, month: v.month, invoice_date: v.invoiceDate };

    if (editing) await save(() => zd.updateIncome(editing.id, oneOff), tc("changesSaved"));
    else if (editingRecurring) await save(() => zd.recurringIncomeOps.update(editingRecurring.id, templateFields), tc("changesSaved"));
    else if (v.isRecurring) await save(() => zd.recurringIncomeOps.add(templateFields), t("addedRecurring"));
    else await save(() => zd.addIncome(oneOff), t("added"));
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className={formClass}>
        <SheetHeader title={editing ? t("editTitle") : editingRecurring ? t("editRecurringTitle") : t("newTitle")} onClose={onClose} />
        <Field label={t("type")} htmlFor="incType">
          <select id="incType" {...register("type")} className={inputClass}>
            {INCOME_TYPES.map((it) => (
              <option key={it} value={it}>
                {typeLabel(it)}
              </option>
            ))}
          </select>
        </Field>
        {!isEdit && (
          <label className="flex flex-row items-center gap-2.5" htmlFor="incRecurring">
            <input id="incRecurring" type="checkbox" {...register("isRecurring")} className={checkboxClass} />
            <span className="text-[13px]">{t("isRecurring")}</span>
          </label>
        )}
        {isRecurring ? (
          <MonthRangeFields idPrefix="inc" kind="income" currentMonth={currentMonth} />
        ) : (
          <>
            <Field label={t("month")} htmlFor="incMonth" error={errors.month?.message}>
              <input
                id="incMonth"
                type="month"
                {...fieldAria("incMonth", errors.month)}
                {...register("month", {
                  required: tv("monthRequired"),
                  onChange: (e) => {
                    // The invoice date follows the month until edited by hand
                    // (and never moves on its own when editing a saved income).
                    if (!editing && !getFieldState("invoiceDate").isDirty && e.target.value) {
                      setValue("invoiceDate", lastDayOfMonth(e.target.value));
                    }
                  },
                })}
                className={inputClass}
              />
            </Field>
            <Field label={t("invoiceDate")} htmlFor="incInvoiceDate" hint={t("invoiceDateHint")} error={errors.invoiceDate?.message}>
              <input
                id="incInvoiceDate"
                type="date"
                {...fieldAria("incInvoiceDate", errors.invoiceDate)}
                {...register("invoiceDate", { required: tv("dateRequired") })}
                className={inputClass}
              />
            </Field>
          </>
        )}
        {type === "b2b" && (
          <Field label={t("hours")} htmlFor="incHours" hint={isRecurring ? t("hoursRecurringHint") : t("hoursHint")} error={errors.hours?.message}>
            <div className="flex flex-row gap-2 items-center">
              <input
                id="incHours"
                type="text"
                inputMode="decimal"
                {...fieldAria("incHours", errors.hours)}
                {...register("hours", {
                  validate: (h) => {
                    if (!String(h).trim()) return true;
                    const n = Number(String(h).replace(",", "."));
                    return (Number.isFinite(n) && n >= 0 && n <= MAX_HOURS) || tv("hoursRange");
                  },
                })}
                className={inputClass + " flex-1"}
                placeholder="0"
              />
              <button
                type="button"
                onClick={() => setValue("hours", String(standardWorkHours(hoursMonth)), { shouldValidate: true, shouldDirty: true })}
                className="text-[12.5px] font-semibold text-accent bg-accent-soft rounded-md px-3 py-2.5 whitespace-nowrap"
              >
                {t("fromWorkingDays")}
              </button>
            </div>
            <div className="text-[11.5px] text-ink-muted mt-1">
              {t("workingDays", { month: monthName(hoursMonth), days: workingDaysInMonth(hoursMonth), hours: standardWorkHours(hoursMonth) })}
            </div>
          </Field>
        )}
        {(type !== "b2b" || isRecurring) && (
          <DescField id="incDesc" label={t("desc")} placeholder={isRecurring ? t("descRecurringPlaceholder") : t("descPlaceholder")} />
        )}
        <AmountWithCurrency id="incAmount" label={t("netAmount")} fx={fx} fxError={fxError} />
        <IconField id="incIcon" label={t("icon")} hint={t("iconHint", { icon: INCOME_TYPE_ICONS[type] })} placeholder={INCOME_TYPE_ICONS[type]} />
        {type === "b2b" && (
          <label className="flex flex-row items-center gap-2.5" htmlFor="incVat">
            <input id="incVat" type="checkbox" {...register("applyVat")} className={checkboxClass} />
            <span className="text-[13px]">{t("withVat")}</span>
          </label>
        )}
        {vatRate > 0 && netAmount > 0 && (
          <div className="text-[12px] text-ink-muted">
            {t("vatNote", { gross: fmt(grossAmount({ amount: netAmount, vat_rate: vatRate }), 2, fx.currency), net: fmt(netAmount, 2, fx.currency) })}
          </div>
        )}
        <SaveButton busy={busy} disabled={fx.loading} label={isEdit ? tc("saveChanges") : tc("save")} />
      </form>
    </FormProvider>
  );
}

// ---------- expense ----------
interface ExpenseValues extends RangeValues {
  categoryId: string;
  desc: string;
  amount: string;
  icon: string;
  isRecurring: boolean;
  dayOfMonth: string;
  date: string;
}

function ExpenseForm({
  zd,
  currentMonth,
  onClose,
  editingExpense,
  editingRecurring,
}: {
  zd: ReturnType<typeof useZoneData>;
  currentMonth: string;
  onClose: () => void;
  editingExpense?: Expense;
  editingRecurring?: RecurringExpense;
}) {
  const t = useTranslations("expenseForm");
  const tc = useTranslations("common");
  const tv = useTranslations("validation");
  const { busy, save } = useSaver(onClose);
  const categories = useCategories();
  const num = useInputNumber();
  const source = editingExpense ?? editingRecurring;
  const form = useForm<ExpenseValues>({
    mode: "onTouched",
    defaultValues: {
      categoryId: source?.category_id ?? "",
      desc: source?.desc ?? "",
      amount: source ? num(source.amount) : "",
      icon: source?.icon ?? "",
      isRecurring: !!editingRecurring,
      dayOfMonth: editingRecurring ? String(editingRecurring.day_of_month) : "1",
      date: editingExpense?.date ?? todayStr(),
      ...rangeDefaults(editingRecurring?.start_month ?? currentMonth, editingRecurring?.end_month ?? null),
    },
  });
  const { register, control, setValue, getValues, handleSubmit, formState } = form;
  const { errors } = formState;
  const [pickedCategory, isRecurring, dayOfMonth, startMonth, date] = useWatch({
    control,
    name: ["categoryId", "isRecurring", "dayOfMonth", "startMonth", "date"],
  });
  // Until the user picks one, default to the first category once the list loads.
  const categoryId = pickedCategory || categories.list[0]?.id || "";
  const maxDay = daysInMonth(startMonth || currentMonth);
  const templateDate = startMonth ? `${startMonth}-${pad2(Math.min(parseInt(dayOfMonth, 10) || 1, maxDay))}` : "";
  const fx = useFx(isRecurring ? templateDate : date, fxInitial(source));
  const { fxError, requireFx } = useFxGuard(fx);
  const selectedCategoryIcon = categories.icon(categoryId) ?? "📦";

  function clampDayTo(month: string) {
    if (month && parseInt(getValues("dayOfMonth"), 10) > daysInMonth(month)) setValue("dayOfMonth", String(daysInMonth(month)));
  }

  async function onSubmit(v: ExpenseValues) {
    const fxFields = requireFx();
    if (!fxFields) return;
    const common = { category_id: v.categoryId || categoryId, desc: v.desc.trim(), amount: toNumber(v.amount), icon: v.icon.trim() || null, ...fxFields };
    const recurringFields = {
      ...common,
      day_of_month: parseInt(v.dayOfMonth, 10) || 1,
      start_month: v.startMonth,
      end_month: storedEnd(v.endMonth),
    };

    if (editingExpense) await save(() => zd.updateExpense(editingExpense.id, { ...common, date: v.date }), tc("changesSaved"));
    else if (editingRecurring) await save(() => zd.recurringExpenseOps.update(editingRecurring.id, recurringFields), tc("changesSaved"));
    else if (v.isRecurring) await save(() => zd.recurringExpenseOps.add(recurringFields), t("addedRecurring"));
    else await save(() => zd.addExpense({ ...common, date: v.date }), t("added"));
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className={formClass}>
        <SheetHeader title={editingExpense ? t("editTitle") : editingRecurring ? t("editRecurringTitle") : t("newTitle")} onClose={onClose} />
        <Field label={t("category")} htmlFor="expCategory" error={errors.categoryId?.message}>
          <select
            id="expCategory"
            {...register("categoryId", { validate: () => !!categoryId || tv("categoryRequired") })}
            value={categoryId}
            className={inputClass}
          >
            {categories.list.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {categories.name(c.id)}
              </option>
            ))}
          </select>
        </Field>
        <DescField id="expDesc" label={t("desc")} placeholder={t("descPlaceholder")} />
        <AmountWithCurrency id="expAmount" label={t("amount")} fx={fx} fxError={fxError} />
        <IconField id="expIcon" label={t("icon")} hint={t("iconHint", { icon: selectedCategoryIcon })} placeholder={selectedCategoryIcon} />

        {!source && (
          <label className="flex flex-row items-center gap-2.5" htmlFor="expRecurring">
            <input id="expRecurring" type="checkbox" {...register("isRecurring")} className={checkboxClass} />
            <span className="text-[13px]">{t("isRecurring")}</span>
          </label>
        )}

        {isRecurring ? (
          <>
            <Field label={t("dayOfMonth")} htmlFor="expDay" hint={parseInt(dayOfMonth, 10) > 28 ? t("dayOfMonthHint") : undefined}>
              <select id="expDay" {...register("dayOfMonth")} className={inputClass}>
                {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            <MonthRangeFields idPrefix="exp" kind="expense" currentMonth={currentMonth} onStartChange={clampDayTo} />
          </>
        ) : (
          <Field label={t("date")} htmlFor="expDate" error={errors.date?.message}>
            <input id="expDate" type="date" {...fieldAria("expDate", errors.date)} {...register("date", { required: tv("dateRequired") })} className={inputClass} />
          </Field>
        )}

        <SaveButton busy={busy} disabled={fx.loading} label={source ? tc("saveChanges") : tc("save")} />
      </form>
    </FormProvider>
  );
}

// ---------- savings ----------
interface SavingsValues {
  date: string;
  desc: string;
  amount: string;
  withdraw: boolean;
}

function SavingsForm({
  zd,
  onClose,
  editing,
}: {
  zd: ReturnType<typeof useZoneData>;
  onClose: () => void;
  editing?: SavingsEntry;
}) {
  const t = useTranslations("savingsForm");
  const tc = useTranslations("common");
  const tv = useTranslations("validation");
  const { busy, save } = useSaver(onClose);
  const num = useInputNumber();
  const form = useForm<SavingsValues>({
    mode: "onTouched",
    defaultValues: {
      date: editing?.date ?? todayStr(),
      desc: editing?.desc ?? "",
      amount: editing ? num(Math.abs(editing.amount)) : "",
      withdraw: editing ? editing.amount < 0 : false,
    },
  });
  const { register, control, handleSubmit, formState } = form;
  const fx = useFx(useWatch({ control, name: "date" }), fxInitial(editing));
  const { fxError, requireFx } = useFxGuard(fx);

  async function onSubmit(v: SavingsValues) {
    const fxFields = requireFx();
    if (!fxFields) return;
    const value = toNumber(v.amount);
    const fields = { date: v.date, desc: v.desc.trim(), amount: v.withdraw ? -value : value, ...fxFields };
    if (editing) await save(() => zd.updateSavingsEntry(editing.id, fields), tc("changesSaved"));
    else await save(() => zd.addSavingsEntry(fields), tc("saved"));
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className={formClass}>
        <SheetHeader title={editing ? t("editTitle") : t("newTitle")} onClose={onClose} />
        <Field label={t("date")} htmlFor="savDate" error={formState.errors.date?.message}>
          <input id="savDate" type="date" {...fieldAria("savDate", formState.errors.date)} {...register("date", { required: tv("dateRequired") })} className={inputClass} />
        </Field>
        <DescField id="savDesc" label={t("desc")} hint={t("descHint")} placeholder={t("descPlaceholder")} />
        <AmountWithCurrency id="savAmount" label={t("amount")} fx={fx} fxError={fxError} />
        <label className="flex flex-row items-center gap-2.5" htmlFor="savWithdraw">
          <input id="savWithdraw" type="checkbox" {...register("withdraw")} className={checkboxClass} />
          <span className="text-[13px]">{t("withdraw")}</span>
        </label>
        <SaveButton busy={busy} disabled={fx.loading} label={editing ? tc("saveChanges") : tc("save")} />
      </form>
    </FormProvider>
  );
}

/** A non-negative amount with at most 2 decimals ("" allowed where noted). */
const MONEY_PATTERN = /^\d+([.,]\d{1,2})?$/;

function EditInitialForm({ zd, onClose }: { zd: ReturnType<typeof useZoneData>; onClose: () => void }) {
  const t = useTranslations("savingsForm");
  const tc = useTranslations("common");
  const tv = useTranslations("validation");
  const { busy, save } = useSaver(onClose);
  const num = useInputNumber();
  const { register, handleSubmit, formState } = useForm<{ initial: string }>({
    mode: "onTouched",
    defaultValues: { initial: num(zd.savingsInitial || 0) },
  });
  const error = formState.errors.initial;

  async function onSubmit(v: { initial: string }) {
    await save(() => zd.setSavingsInitial(toNumber(v.initial)), t("initialSaved"));
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className={formClass}>
      <SheetHeader title={t("initialTitle")} onClose={onClose} />
      <Field label={t("initial")} htmlFor="initialAmount" hint={t("initialHint")} error={error?.message}>
        <input
          id="initialAmount"
          type="text"
          inputMode="decimal"
          {...fieldAria("initialAmount", error)}
          {...register("initial", { validate: (v) => MONEY_PATTERN.test(String(v).trim()) || tv("initialInvalid") })}
          className={inputClass}
        />
      </Field>
      <SaveButton busy={busy} label={tc("save")} />
    </form>
  );
}

// ---------- monthly budgets ----------
function BudgetsForm({ zd, onClose }: { zd: ReturnType<typeof useZoneData>; onClose: () => void }) {
  const t = useTranslations("budgetsForm");
  const tv = useTranslations("validation");
  const { busy, save } = useSaver(onClose);
  const categories = useCategories();
  const num = useInputNumber();
  // Keyed by category id; "" means "don't track this category".
  const { register, handleSubmit, formState } = useForm<{ limits: Record<string, string> }>({
    mode: "onTouched",
    defaultValues: { limits: Object.fromEntries(zd.budgets.map((b) => [b.category_id, num(b.amount)])) },
  });

  async function onSubmit(v: { limits: Record<string, string> }) {
    const limits = Object.fromEntries(Object.entries(v.limits ?? {}).map(([category, raw]) => [category, toNumber(raw ?? "")]));
    await save(() => zd.saveBudgets(limits), t("saved"));
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className={formClass}>
      <SheetHeader title={t("title")} onClose={onClose} />
      <div className="text-[12.5px] text-ink-muted -mt-1">{t("intro")}</div>
      <div className="flex flex-col gap-2">
        {categories.list.map((c) => {
          const id = `budget-${c.key}`;
          const error = formState.errors.limits?.[c.id];
          return (
            <div key={c.id} className="flex flex-col gap-1">
              <label htmlFor={id} className="flex items-center gap-2.5">
                <span className="text-[17px] w-6 text-center shrink-0">{c.icon}</span>
                <span className="flex-1 text-[13px] font-medium truncate">{categories.name(c.id)}</span>
                <input
                  id={id}
                  type="text"
                  inputMode="decimal"
                  {...fieldAria(id, error)}
                  {...register(`limits.${c.id}`, {
                    validate: (raw) => {
                      const s = String(raw ?? "").trim();
                      return !s || (MONEY_PATTERN.test(s) && toNumber(s) > 0) || tv("budgetInvalid");
                    },
                  })}
                  placeholder={t("none")}
                  className={inputClass + " w-28 text-right py-2"}
                />
              </label>
              {error && (
                <span id={`${id}-error`} role="alert" className="text-[11.5px] text-critical text-right">
                  {error.message}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <SaveButton busy={busy} label={t("save")} />
    </form>
  );
}

// ---------- recurring skip / disable menu ----------
function RecurringMenu({
  zd,
  kind,
  templateId,
  month,
  onClose,
}: {
  zd: ReturnType<typeof useZoneData>;
  kind: "expense" | "income";
  templateId: string;
  month: string;
  onClose: () => void;
}) {
  const t = useTranslations("recurringMenu");
  const typeLabel = useIncomeTypeLabel();
  const { month: monthName, monthIn } = useMonthFormat();
  const { fmt } = useMoney();
  const { showToast } = useToast();
  const categories = useCategories();
  const ops = kind === "income" ? zd.recurringIncomeOps : zd.recurringExpenseOps;
  const expenseTpl = kind === "expense" ? zd.recurring.find((r) => r.id === templateId) : undefined;
  const incomeTpl = kind === "income" ? zd.recurringIncomes.find((r) => r.id === templateId) : undefined;
  const tpl = expenseTpl ?? incomeTpl;
  if (!tpl) return null;

  const label = expenseTpl ? expenseTpl.desc || categories.name(expenseTpl.category_id) : incomeTpl!.desc || typeLabel(incomeTpl!.type);
  const deletesWhole = month <= tpl.start_month;

  async function handleSkip() {
    await ops.skip(templateId, month);
    onClose();
    showToast(t("skipped", { month: monthName(month) }), () => ops.undoSkip(templateId, month));
  }

  async function handleDisable() {
    const result = await ops.disableFrom(templateId, month);
    onClose();
    if (!result) return;
    showToast(
      result.deleted ? t("deleted", { label }) : t("disabled", { month: monthIn(month) }),
      result.undo
    );
  }

  return (
    <>
      <SheetHeader title={label} onClose={onClose} />
      <div className="text-[12.5px] text-ink-muted">
        {t("intro", { kind, amount: fmt(incomeTpl ? grossAmount(incomeTpl) : tpl.amount, 2, tpl.currency), month: monthName(month) })}
      </div>
      <button type="button" onClick={handleSkip} className="font-semibold text-[13px] text-accent bg-accent-soft border-none rounded-md py-2.5">
        {t("skipOnly", { month: monthName(month) })}
      </button>
      <button type="button" onClick={handleDisable} className="font-semibold text-[13px] text-critical bg-critical-soft border-none rounded-md py-2.5 mb-1">
        {deletesWhole ? t("deleteWhole", { month: monthName(month) }) : t("disableFrom", { month: monthIn(month) })}
      </button>
    </>
  );
}
