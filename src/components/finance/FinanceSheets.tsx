"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useIncomeTypeLabel, useMonthFormat } from "@/i18n/useFormat";
import { useMoney } from "@/components/finance/MoneyContext";
import { useZoneData } from "@/lib/useZoneData";
import { useCategories } from "@/lib/useCategories";
import { daysInMonth, grossAmount, lastDayOfMonth, nextMonth, pad2, prevMonth, todayStr } from "@/lib/finance";
import { standardWorkHours, workingDaysInMonth } from "@/lib/polishHolidays";
import { Expense, Income, IncomeType, INCOME_TYPE_ICONS, INCOME_TYPES, RecurringExpense, RecurringIncome, SavingsEntry, VAT_RATE } from "@/lib/types";
import { Sheet, SheetHeader, Field } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { MonthStats } from "@/components/finance/MonthStats";
import { AmountWithCurrency, FxInitial, useFx } from "@/components/finance/FxField";

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
  "text-[14.5px] font-medium text-ink bg-sheet-field-bg border border-border rounded-md px-3 py-2.5 outline-none focus:border-accent tabular-nums";

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

function SaveButton({ busy, onClick, label, disabled = false }: { busy: boolean; onClick: () => void; label: string; disabled?: boolean }) {
  const t = useTranslations("common");
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className="font-bold text-[14.5px] text-accent-ink bg-accent rounded-md py-3 mb-1 disabled:opacity-60"
    >
      {busy ? t("saving") : label}
    </button>
  );
}

const fxInitial = (x?: FxInitial): FxInitial | undefined =>
  x ? { currency: x.currency, fx_rate: Number(x.fx_rate), fx_date: x.fx_date, fx_table: x.fx_table } : undefined;

// Start/end month of a recurring template. `endMonth` is the last *inclusive*
// month shown to the user; the DB stores the exclusive cutoff (month after).
function useMonthRange(initialStart: string, storedEnd: string | null) {
  const [startMonth, setStartMonth] = useState(initialStart);
  const [endMonth, setEndMonth] = useState(storedEnd ? prevMonth(storedEnd) : "");
  return {
    startMonth,
    endMonth,
    changeStart(v: string) {
      setStartMonth(v);
      if (endMonth && endMonth < v) setEndMonth(v);
    },
    changeEnd(v: string) {
      setEndMonth(v && v < startMonth ? startMonth : v);
    },
    clearEnd() {
      setEndMonth("");
    },
    storedEnd: endMonth ? nextMonth(endMonth) : null,
  };
}

function MonthRangeFields({
  range,
  idPrefix,
  kind,
  currentMonth,
  onStartChange,
}: {
  range: ReturnType<typeof useMonthRange>;
  idPrefix: string;
  kind: "income" | "expense";
  currentMonth: string;
  onStartChange?: (value: string) => void;
}) {
  const t = useTranslations("range");
  const tc = useTranslations("common");
  const { month, monthIn } = useMonthFormat();
  const { startMonth, endMonth } = range;
  return (
    <>
      <Field
        label={t("from")}
        htmlFor={`${idPrefix}StartMonth`}
        hint={
          startMonth < currentMonth
            ? t("fromPastHint", { month: monthIn(startMonth) })
            : t("fromHint", { kind, month: monthIn(startMonth) })
        }
      >
        <input
          id={`${idPrefix}StartMonth`}
          type="month"
          value={startMonth}
          onChange={(e) => {
            range.changeStart(e.target.value);
            onStartChange?.(e.target.value);
          }}
          className={inputClass}
        />
      </Field>
      <Field
        label={t("to")}
        htmlFor={`${idPrefix}EndMonth`}
        hint={endMonth ? t("toHint", { last: month(endMonth), next: monthIn(nextMonth(endMonth)) }) : t("toEmptyHint")}
      >
        <div className="flex flex-row gap-2 items-center">
          <input
            id={`${idPrefix}EndMonth`}
            type="month"
            min={startMonth}
            value={endMonth}
            onChange={(e) => range.changeEnd(e.target.value)}
            className={inputClass + " flex-1"}
          />
          {endMonth && (
            <button
              type="button"
              onClick={range.clearEnd}
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
  const typeLabel = useIncomeTypeLabel();
  const { month: monthName } = useMonthFormat();
  const { fmt } = useMoney();
  const { busy, save } = useSaver(onClose);
  const source = editing ?? editingRecurring;
  const isEdit = !!source;
  const [type, setType] = useState<IncomeType>(source?.type ?? "b2b");
  const [month, setMonth] = useState(editing?.month ?? currentMonth);
  const [invoiceDate, setInvoiceDate] = useState(editing?.invoice_date ?? lastDayOfMonth(editing?.month ?? currentMonth));
  const [invoiceTouched, setInvoiceTouched] = useState(!!editing);
  const [hours, setHours] = useState(source ? String(source.hours) : "");
  const [amount, setAmount] = useState(source ? String(source.amount) : "");
  const [desc, setDesc] = useState(source?.desc ?? "");
  const [applyVat, setApplyVat] = useState((source?.vat_rate ?? 0) > 0);
  const [icon, setIcon] = useState(source?.icon ?? "");
  const [isRecurring, setIsRecurring] = useState(!!editingRecurring);
  const range = useMonthRange(editingRecurring?.start_month ?? currentMonth, editingRecurring?.end_month ?? null);
  const hoursMonth = isRecurring ? range.startMonth : month;
  // One-off: rate from the invoice date. Template: from its first month (each
  // month then gets its own rate, see useZoneData).
  const fx = useFx(isRecurring ? lastDayOfMonth(range.startMonth) : invoiceDate, fxInitial(source));

  const netAmount = parseFloat(amount) || 0;
  // Amount is always stored net; VAT is kept as a rate so gross can be shown
  // without ever inflating "na czysto" totals.
  const vatRate = type === "b2b" && applyVat ? VAT_RATE : 0;

  function handleSave() {
    if (netAmount <= 0 || !fx.fields) return;
    const fields = { type, hours: parseFloat(hours) || 0, desc: desc.trim(), icon: icon.trim() || null, amount: netAmount, vat_rate: vatRate, ...fx.fields };
    const templateFields = { ...fields, start_month: range.startMonth, end_month: range.storedEnd };
    const oneOff = { ...fields, month, invoice_date: invoiceDate };

    if (editing) {
      save(() => zd.updateIncome(editing.id, oneOff), tc("changesSaved"));
    } else if (editingRecurring) {
      save(() => zd.recurringIncomeOps.update(editingRecurring.id, templateFields), tc("changesSaved"));
    } else if (isRecurring) {
      save(() => zd.recurringIncomeOps.add(templateFields), t("addedRecurring"));
    } else {
      save(() => zd.addIncome(oneOff), t("added"));
    }
  }

  return (
    <>
      <SheetHeader
        title={editing ? t("editTitle") : editingRecurring ? t("editRecurringTitle") : t("newTitle")}
        onClose={onClose}
      />
      <Field label={t("type")} htmlFor="incType">
        <select id="incType" value={type} onChange={(e) => setType(e.target.value as IncomeType)} className={inputClass}>
          {INCOME_TYPES.map((it) => (
            <option key={it} value={it}>
              {typeLabel(it)}
            </option>
          ))}
        </select>
      </Field>
      {!isEdit && (
        <label className="flex flex-row items-center gap-2.5" htmlFor="incRecurring">
          <input id="incRecurring" type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="w-[17px] h-[17px] accent-accent shrink-0" />
          <span className="text-[13px]">{t("isRecurring")}</span>
        </label>
      )}
      {isRecurring ? (
        <MonthRangeFields range={range} idPrefix="inc" kind="income" currentMonth={currentMonth} />
      ) : (
        <>
          <Field label={t("month")} htmlFor="incMonth">
            <input
              id="incMonth"
              type="month"
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                if (!invoiceTouched && e.target.value) setInvoiceDate(lastDayOfMonth(e.target.value));
              }}
              className={inputClass}
            />
          </Field>
          <Field label={t("invoiceDate")} htmlFor="incInvoiceDate" hint={t("invoiceDateHint")}>
            <input
              id="incInvoiceDate"
              type="date"
              value={invoiceDate}
              onChange={(e) => {
                setInvoiceDate(e.target.value);
                setInvoiceTouched(true);
              }}
              className={inputClass}
            />
          </Field>
        </>
      )}
      {type === "b2b" && (
        <Field
          label={t("hours")}
          htmlFor="incHours"
          hint={isRecurring ? t("hoursRecurringHint") : t("hoursHint")}
        >
          <div className="flex flex-row gap-2 items-center">
            <input id="incHours" type="number" min={0} step={1} value={hours} onChange={(e) => setHours(e.target.value)} className={inputClass + " flex-1"} placeholder="0" />
            <button
              type="button"
              onClick={() => setHours(String(standardWorkHours(hoursMonth)))}
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
        <Field label={t("desc")} htmlFor="incDesc">
          <input id="incDesc" type="text" value={desc} onChange={(e) => setDesc(e.target.value)} className={inputClass} placeholder={isRecurring ? t("descRecurringPlaceholder") : t("descPlaceholder")} />
        </Field>
      )}
      <AmountWithCurrency id="incAmount" label={t("netAmount")} amount={amount} setAmount={setAmount} fx={fx} />
      <Field label={t("icon")} htmlFor="incIcon" hint={t("iconHint", { icon: INCOME_TYPE_ICONS[type] })}>
        <input
          id="incIcon"
          type="text"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          placeholder={INCOME_TYPE_ICONS[type]}
          maxLength={4}
          className={inputClass + " text-[18px] text-center w-16"}
        />
      </Field>
      {type === "b2b" && (
        <label className="flex flex-row items-center gap-2.5" htmlFor="incVat">
          <input id="incVat" type="checkbox" checked={applyVat} onChange={(e) => setApplyVat(e.target.checked)} className="w-[17px] h-[17px] accent-accent shrink-0" />
          <span className="text-[13px]">{t("withVat")}</span>
        </label>
      )}
      {vatRate > 0 && netAmount > 0 && (
        <div className="text-[12px] text-ink-muted">
          {t("vatNote", { gross: fmt(grossAmount({ amount: netAmount, vat_rate: vatRate }), 2, fx.currency), net: fmt(netAmount, 2, fx.currency) })}
        </div>
      )}
      <SaveButton busy={busy} disabled={!fx.fields} onClick={handleSave} label={isEdit ? tc("saveChanges") : tc("save")} />
    </>
  );
}

// ---------- expense ----------
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
  const { busy, save } = useSaver(onClose);
  const categories = useCategories();
  const [pickedCategory, setCategory] = useState<string>(editingExpense?.category_id ?? editingRecurring?.category_id ?? "");
  // Until the user picks one, default to the first category once the list loads.
  const categoryId = pickedCategory || categories.list[0]?.id || "";
  const [desc, setDesc] = useState(editingExpense?.desc ?? editingRecurring?.desc ?? "");
  const [amount, setAmount] = useState(
    editingExpense ? String(editingExpense.amount) : editingRecurring ? String(editingRecurring.amount) : ""
  );
  const [date, setDate] = useState(editingExpense?.date ?? todayStr());
  const [icon, setIcon] = useState(editingExpense?.icon ?? editingRecurring?.icon ?? "");
  const [isRecurring, setIsRecurring] = useState(!!editingRecurring);
  const [dayOfMonth, setDayOfMonth] = useState(editingRecurring ? String(editingRecurring.day_of_month) : "1");
  const range = useMonthRange(editingRecurring?.start_month ?? currentMonth, editingRecurring?.end_month ?? null);
  const maxDay = daysInMonth(range.startMonth);
  const templateDate = `${range.startMonth}-${pad2(Math.min(parseInt(dayOfMonth, 10) || 1, maxDay))}`;
  const fx = useFx(isRecurring ? templateDate : date, fxInitial(editingExpense ?? editingRecurring));
  const selectedCategoryIcon = categories.icon(categoryId) ?? "📦";

  function clampDayTo(month: string) {
    if (parseInt(dayOfMonth, 10) > daysInMonth(month)) setDayOfMonth(String(daysInMonth(month)));
  }

  function handleSave() {
    const value = parseFloat(amount) || 0;
    if (value <= 0 || !fx.fields) return;
    const common = { category_id: categoryId, desc: desc.trim(), amount: value, icon: icon.trim() || null, ...fx.fields };
    const recurringFields = {
      ...common,
      day_of_month: parseInt(dayOfMonth, 10) || 1,
      start_month: range.startMonth,
      end_month: range.storedEnd,
    };

    if (editingExpense) {
      save(() => zd.updateExpense(editingExpense.id, { ...common, date }), tc("changesSaved"));
    } else if (editingRecurring) {
      save(() => zd.recurringExpenseOps.update(editingRecurring.id, recurringFields), tc("changesSaved"));
    } else if (isRecurring) {
      save(() => zd.recurringExpenseOps.add(recurringFields), t("addedRecurring"));
    } else {
      save(() => zd.addExpense({ ...common, date }), t("added"));
    }
  }

  return (
    <>
      <SheetHeader
        title={editingExpense ? t("editTitle") : editingRecurring ? t("editRecurringTitle") : t("newTitle")}
        onClose={onClose}
      />
      <Field label={t("category")} htmlFor="expCategory">
        <select id="expCategory" value={categoryId} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
          {categories.list.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {categories.name(c.id)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("desc")} htmlFor="expDesc">
        <input id="expDesc" type="text" value={desc} onChange={(e) => setDesc(e.target.value)} className={inputClass} placeholder={t("descPlaceholder")} />
      </Field>
      <AmountWithCurrency id="expAmount" label={t("amount")} amount={amount} setAmount={setAmount} fx={fx} />
      <Field label={t("icon")} htmlFor="expIcon" hint={t("iconHint", { icon: selectedCategoryIcon })}>
        <input
          id="expIcon"
          type="text"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          placeholder={selectedCategoryIcon}
          maxLength={4}
          className={inputClass + " text-[18px] text-center w-16"}
        />
      </Field>

      {!editingExpense && !editingRecurring && (
        <label className="flex flex-row items-center gap-2.5" htmlFor="expRecurring">
          <input id="expRecurring" type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="w-[17px] h-[17px] accent-accent shrink-0" />
          <span className="text-[13px]">{t("isRecurring")}</span>
        </label>
      )}

      {isRecurring ? (
        <>
          <Field
            label={t("dayOfMonth")}
            htmlFor="expDay"
            hint={parseInt(dayOfMonth, 10) > 28 ? t("dayOfMonthHint") : undefined}
          >
            <select id="expDay" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} className={inputClass}>
              {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
          <MonthRangeFields range={range} idPrefix="exp" kind="expense" currentMonth={currentMonth} onStartChange={clampDayTo} />
        </>
      ) : (
        <Field label={t("date")} htmlFor="expDate">
          <input id="expDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </Field>
      )}

      <SaveButton busy={busy} disabled={!fx.fields} onClick={handleSave} label={editingExpense || editingRecurring ? tc("saveChanges") : tc("save")} />
    </>
  );
}

// ---------- savings ----------
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
  const { busy, save } = useSaver(onClose);
  const [date, setDate] = useState(editing?.date ?? todayStr());
  const [desc, setDesc] = useState(editing?.desc ?? "");
  const [amount, setAmount] = useState(editing ? String(Math.abs(editing.amount)) : "");
  const [withdraw, setWithdraw] = useState(editing ? editing.amount < 0 : false);
  const fx = useFx(date, fxInitial(editing));

  function handleSave() {
    const value = parseFloat(amount) || 0;
    if (value <= 0) return;
    if (!fx.fields) return;
    const fields = { date, desc: desc.trim(), amount: withdraw ? -value : value, ...fx.fields };
    if (editing) {
      save(() => zd.updateSavingsEntry(editing.id, fields), tc("changesSaved"));
    } else {
      save(() => zd.addSavingsEntry(fields), tc("saved"));
    }
  }

  return (
    <>
      <SheetHeader title={editing ? t("editTitle") : t("newTitle")} onClose={onClose} />
      <Field label={t("date")} htmlFor="savDate">
        <input id="savDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
      </Field>
      <Field label={t("desc")} htmlFor="savDesc" hint={t("descHint")}>
        <input id="savDesc" type="text" value={desc} onChange={(e) => setDesc(e.target.value)} className={inputClass} placeholder={t("descPlaceholder")} />
      </Field>
      <AmountWithCurrency id="savAmount" label={t("amount")} amount={amount} setAmount={setAmount} fx={fx} />
      <label className="flex flex-row items-center gap-2.5" htmlFor="savWithdraw">
        <input id="savWithdraw" type="checkbox" checked={withdraw} onChange={(e) => setWithdraw(e.target.checked)} className="w-[17px] h-[17px] accent-accent shrink-0" />
        <span className="text-[13px]">{t("withdraw")}</span>
      </label>
      <SaveButton busy={busy} disabled={!fx.fields} onClick={handleSave} label={editing ? tc("saveChanges") : tc("save")} />
    </>
  );
}

function EditInitialForm({ zd, onClose }: { zd: ReturnType<typeof useZoneData>; onClose: () => void }) {
  const t = useTranslations("savingsForm");
  const tc = useTranslations("common");
  const { busy, save } = useSaver(onClose);
  const [value, setValue] = useState(String(zd.savingsInitial || 0));

  function handleSave() {
    save(() => zd.setSavingsInitial(parseFloat(value) || 0), t("initialSaved"));
  }

  return (
    <>
      <SheetHeader title={t("initialTitle")} onClose={onClose} />
      <Field label={t("initial")} htmlFor="initialAmount" hint={t("initialHint")}>
        <input id="initialAmount" type="number" min={0} step={0.01} value={value} onChange={(e) => setValue(e.target.value)} className={inputClass} />
      </Field>
      <SaveButton busy={busy} onClick={handleSave} label={tc("save")} />
    </>
  );
}

// ---------- monthly budgets ----------
function BudgetsForm({ zd, onClose }: { zd: ReturnType<typeof useZoneData>; onClose: () => void }) {
  const t = useTranslations("budgetsForm");
  const { busy, save } = useSaver(onClose);
  const categories = useCategories();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(zd.budgets.map((b) => [b.category_id, String(b.amount)]))
  );

  function handleSave() {
    const limits = Object.fromEntries(
      Object.entries(values).map(([category, raw]) => [category, parseFloat(raw) || 0])
    );
    save(() => zd.saveBudgets(limits), t("saved"));
  }

  return (
    <>
      <SheetHeader title={t("title")} onClose={onClose} />
      <div className="text-[12.5px] text-ink-muted -mt-1">{t("intro")}</div>
      <div className="flex flex-col gap-2">
        {categories.list.map((c) => (
          <label key={c.id} htmlFor={`budget-${c.key}`} className="flex items-center gap-2.5">
            <span className="text-[17px] w-6 text-center shrink-0">{c.icon}</span>
            <span className="flex-1 text-[13px] font-medium truncate">{categories.name(c.id)}</span>
            <input
              id={`budget-${c.key}`}
              type="number"
              min={0}
              step={1}
              inputMode="decimal"
              value={values[c.id] ?? ""}
              onChange={(e) => setValues((prev) => ({ ...prev, [c.id]: e.target.value }))}
              placeholder={t("none")}
              className={inputClass + " w-28 text-right py-2"}
            />
          </label>
        ))}
      </div>
      <SaveButton busy={busy} onClick={handleSave} label={t("save")} />
    </>
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
