"use client";

import { useState } from "react";
import { useZoneData } from "@/lib/useZoneData";
import { useCategories } from "@/lib/useCategories";
import { daysInMonth, fmt, monthLabel, monthLabelGenitive, nextMonth, prevMonth, todayStr } from "@/lib/finance";
import { standardWorkHours, workingDaysInMonth } from "@/lib/polishHolidays";
import { Expense, Income, IncomeType, INCOME_TYPE_ICONS, INCOME_TYPE_LABELS, RecurringExpense, RecurringIncome, SavingsEntry } from "@/lib/types";
import { Sheet, SheetHeader, Field } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";

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
  | { type: "recurringMenu"; kind: "expense" | "income"; templateId: string; month: string }
  | null;

const inputClass =
  "text-[14.5px] font-medium text-ink bg-sheet-field-bg border border-border rounded-md px-3 py-2.5 outline-none focus:border-accent tabular-nums";

type SaveResult = { message: string } | null | undefined;

// Guards against double-submits (a slow response used to invite repeat taps,
// creating duplicate rows) and surfaces save failures instead of silently
// leaving the sheet open.
function useSaver(onClose: () => void) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  async function save(action: () => Promise<SaveResult>, successMessage: string) {
    if (busy) return;
    setBusy(true);
    let error: SaveResult;
    try {
      error = await action();
    } catch (e) {
      error = { message: e instanceof Error ? e.message : "brak połączenia" };
    }
    setBusy(false);
    if (error) {
      showToast(`Nie udało się zapisać: ${error.message}`);
      return;
    }
    onClose();
    showToast(successMessage);
  }

  return { busy, save };
}

function SaveButton({ busy, onClick, label }: { busy: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="font-bold text-[14.5px] text-accent-ink bg-accent rounded-md py-3 mb-1 disabled:opacity-60"
    >
      {busy ? "Zapisywanie…" : label}
    </button>
  );
}

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
  noun,
  currentMonth,
  onStartChange,
}: {
  range: ReturnType<typeof useMonthRange>;
  idPrefix: string;
  noun: string;
  currentMonth: string;
  onStartChange?: (value: string) => void;
}) {
  const { startMonth, endMonth } = range;
  return (
    <>
      <Field
        label="Obowiązuje od"
        htmlFor={`${idPrefix}StartMonth`}
        hint={
          startMonth < currentMonth
            ? `Doliczy się też do wcześniejszych miesięcy, od ${monthLabelGenitive(startMonth)}.`
            : `${noun} zacznie obowiązywać od ${monthLabelGenitive(startMonth)}.`
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
        label="Do (opcjonalnie)"
        htmlFor={`${idPrefix}EndMonth`}
        hint={
          endMonth
            ? `Ostatni miesiąc: ${monthLabel(endMonth)}. Od ${monthLabelGenitive(nextMonth(endMonth))} już się nie doliczy.`
            : "Zostaw puste, żeby obowiązywał bezterminowo."
        }
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
              Usuń
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
  const { busy, save } = useSaver(onClose);
  const source = editing ?? editingRecurring;
  const isEdit = !!source;
  const [type, setType] = useState<IncomeType>(source?.type ?? "b2b");
  const [month, setMonth] = useState(editing?.month ?? currentMonth);
  const [hours, setHours] = useState(source ? String(source.hours) : "");
  const [amount, setAmount] = useState(source ? String(source.amount) : "");
  const [desc, setDesc] = useState(source?.desc ?? "");
  const [applyVat, setApplyVat] = useState(false);
  const [icon, setIcon] = useState(source?.icon ?? "");
  const [isRecurring, setIsRecurring] = useState(!!editingRecurring);
  const range = useMonthRange(editingRecurring?.start_month ?? currentMonth, editingRecurring?.end_month ?? null);
  const hoursMonth = isRecurring ? range.startMonth : month;

  const baseAmount = parseFloat(amount) || 0;
  // VAT is only offered when adding: an existing row stores just the final amount.
  const finalAmount = !isEdit && type === "b2b" && applyVat ? baseAmount * 1.23 : baseAmount;

  function handleSave() {
    if (baseAmount <= 0) return;
    const fields = { type, hours: parseFloat(hours) || 0, desc: desc.trim(), icon: icon.trim() || null, amount: finalAmount };
    const templateFields = { ...fields, start_month: range.startMonth, end_month: range.storedEnd };

    if (editing) {
      save(() => zd.updateIncome(editing.id, { ...fields, month }), "Zapisano zmiany");
    } else if (editingRecurring) {
      save(() => zd.recurringIncomeOps.update(editingRecurring.id, templateFields), "Zapisano zmiany");
    } else if (isRecurring) {
      save(() => zd.recurringIncomeOps.add(templateFields), "Dodano zarobek stały");
    } else {
      save(() => zd.addIncome({ ...fields, month }), "Dodano zarobek");
    }
  }

  return (
    <>
      <SheetHeader
        title={editing ? "Edytuj zarobek" : editingRecurring ? "Edytuj zarobek stały" : "Nowy zarobek"}
        onClose={onClose}
      />
      <Field label="Typ przychodu" htmlFor="incType">
        <select id="incType" value={type} onChange={(e) => setType(e.target.value as IncomeType)} className={inputClass}>
          {(Object.keys(INCOME_TYPE_LABELS) as IncomeType[]).map((t) => (
            <option key={t} value={t}>
              {INCOME_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </Field>
      {!isEdit && (
        <label className="flex flex-row items-center gap-2.5" htmlFor="incRecurring">
          <input id="incRecurring" type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="w-[17px] h-[17px] accent-accent shrink-0" />
          <span className="text-[13px]">To zarobek stały (co miesiąc)</span>
        </label>
      )}
      {isRecurring ? (
        <MonthRangeFields range={range} idPrefix="inc" noun="Zarobek stały" currentMonth={currentMonth} />
      ) : (
        <Field label="Miesiąc" htmlFor="incMonth">
          <input id="incMonth" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={inputClass} />
        </Field>
      )}
      {type === "b2b" && (
        <Field
          label="Godziny (opcjonalnie)"
          htmlFor="incHours"
          hint={isRecurring ? "Do wyliczenia stawki zł/h — ta sama liczba godzin w każdym miesiącu." : "Do wyliczenia stawki zł/h na czysto."}
        >
          <div className="flex flex-row gap-2 items-center">
            <input id="incHours" type="number" min={0} step={1} value={hours} onChange={(e) => setHours(e.target.value)} className={inputClass + " flex-1"} placeholder="0" />
            <button
              type="button"
              onClick={() => setHours(String(standardWorkHours(hoursMonth)))}
              className="text-[12.5px] font-semibold text-accent bg-accent-soft rounded-md px-3 py-2.5 whitespace-nowrap"
            >
              Z dni roboczych
            </button>
          </div>
          <div className="text-[11.5px] text-ink-muted mt-1">
            {monthLabel(hoursMonth)}: {workingDaysInMonth(hoursMonth)} dni robocze (bez weekendów i świąt) × 8h = {standardWorkHours(hoursMonth)} h
          </div>
        </Field>
      )}
      {(type !== "b2b" || isRecurring) && (
        <Field label="Opis (opcjonalnie)" htmlFor="incDesc">
          <input id="incDesc" type="text" value={desc} onChange={(e) => setDesc(e.target.value)} className={inputClass} placeholder={isRecurring ? "np. pensja, klient X" : "np. prezent od klienta"} />
        </Field>
      )}
      <Field label="Kwota netto" htmlFor="incAmount">
        <input id="incAmount" type="number" min={0} step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} placeholder="0" />
      </Field>
      <Field label="Ikona (opcjonalnie)" htmlFor="incIcon" hint={`Domyślna dla tego typu: ${INCOME_TYPE_ICONS[type]}`}>
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
      {!isEdit && type === "b2b" && (
        <label className="flex flex-row items-center gap-2.5" htmlFor="incVat">
          <input id="incVat" type="checkbox" checked={applyVat} onChange={(e) => setApplyVat(e.target.checked)} className="w-[17px] h-[17px] accent-accent shrink-0" />
          <span className="text-[13px]">Doliczyć VAT 23%</span>
        </label>
      )}
      {!isEdit && type === "b2b" && applyVat && baseAmount > 0 && (
        <div className="text-[12px] text-ink-muted">Kwota brutto: {fmt(finalAmount)}</div>
      )}
      <SaveButton busy={busy} onClick={handleSave} label={isEdit ? "Zapisz zmiany" : "Zapisz"} />
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
  const { busy, save } = useSaver(onClose);
  const categories = useCategories();
  const [pickedCategory, setCategory] = useState<string>(editingExpense?.category ?? editingRecurring?.category ?? "");
  // Until the user picks one, default to the first category once the list loads.
  const category = pickedCategory || categories[0]?.name || "";
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
  const selectedCategoryIcon = categories.find((c) => c.name === category)?.icon ?? "📦";

  function clampDayTo(month: string) {
    if (parseInt(dayOfMonth, 10) > daysInMonth(month)) setDayOfMonth(String(daysInMonth(month)));
  }

  function handleSave() {
    const value = parseFloat(amount) || 0;
    if (value <= 0) return;
    const common = { category, desc: desc.trim(), amount: value, icon: icon.trim() || null };
    const recurringFields = {
      ...common,
      day_of_month: parseInt(dayOfMonth, 10) || 1,
      start_month: range.startMonth,
      end_month: range.storedEnd,
    };

    if (editingExpense) {
      save(() => zd.updateExpense(editingExpense.id, { ...common, date }), "Zapisano zmiany");
    } else if (editingRecurring) {
      save(() => zd.recurringExpenseOps.update(editingRecurring.id, recurringFields), "Zapisano zmiany");
    } else if (isRecurring) {
      save(() => zd.recurringExpenseOps.add(recurringFields), "Dodano wydatek stały");
    } else {
      save(() => zd.addExpense({ ...common, date }), "Dodano wydatek");
    }
  }

  return (
    <>
      <SheetHeader
        title={editingExpense ? "Edytuj wydatek" : editingRecurring ? "Edytuj wydatek stały" : "Nowy wydatek"}
        onClose={onClose}
      />
      <Field label="Kategoria" htmlFor="expCategory">
        <select id="expCategory" value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
          {categories.map((c) => (
            <option key={c.name} value={c.name}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Opis (opcjonalnie)" htmlFor="expDesc">
        <input id="expDesc" type="text" value={desc} onChange={(e) => setDesc(e.target.value)} className={inputClass} placeholder="np. zakupy spożywcze" />
      </Field>
      <Field label="Kwota" htmlFor="expAmount">
        <input id="expAmount" type="number" min={0} step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} placeholder="0" />
      </Field>
      <Field label="Ikona (opcjonalnie)" htmlFor="expIcon" hint={`Domyślna dla tej kategorii: ${selectedCategoryIcon}`}>
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
          <span className="text-[13px]">To wydatek stały (co miesiąc)</span>
        </label>
      )}

      {isRecurring ? (
        <>
          <Field
            label="Dzień miesiąca"
            htmlFor="expDay"
            hint={
              parseInt(dayOfMonth, 10) > 28
                ? "W krótszych miesiącach (np. luty) doliczy się w ich ostatnim dniu."
                : undefined
            }
          >
            <select id="expDay" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} className={inputClass}>
              {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
          <MonthRangeFields range={range} idPrefix="exp" noun="Wydatek stały" currentMonth={currentMonth} onStartChange={clampDayTo} />
        </>
      ) : (
        <Field label="Data" htmlFor="expDate">
          <input id="expDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </Field>
      )}

      <SaveButton busy={busy} onClick={handleSave} label={editingExpense || editingRecurring ? "Zapisz zmiany" : "Zapisz"} />
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
  const { busy, save } = useSaver(onClose);
  const [date, setDate] = useState(editing?.date ?? todayStr());
  const [desc, setDesc] = useState(editing?.desc ?? "");
  const [amount, setAmount] = useState(editing ? String(Math.abs(editing.amount)) : "");
  const [withdraw, setWithdraw] = useState(editing ? editing.amount < 0 : false);

  function handleSave() {
    const value = parseFloat(amount) || 0;
    if (value <= 0) return;
    const fields = { date, desc: desc.trim(), amount: withdraw ? -value : value };
    if (editing) {
      save(() => zd.updateSavingsEntry(editing.id, fields), "Zapisano zmiany");
    } else {
      save(() => zd.addSavingsEntry(fields), "Zapisano");
    }
  }

  return (
    <>
      <SheetHeader title={editing ? "Edytuj wpis" : "Dodaj do oszczędności"} onClose={onClose} />
      <Field label="Data" htmlFor="savDate">
        <input id="savDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
      </Field>
      <Field label="Opis (opcjonalnie)" htmlFor="savDesc" hint='Np. „odłożone z faktury”, „wakacje”, „nagły wydatek”.'>
        <input id="savDesc" type="text" value={desc} onChange={(e) => setDesc(e.target.value)} className={inputClass} placeholder="np. odłożone z faktury" />
      </Field>
      <Field label="Kwota" htmlFor="savAmount">
        <input id="savAmount" type="number" min={0} step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} placeholder="0" />
      </Field>
      <label className="flex flex-row items-center gap-2.5" htmlFor="savWithdraw">
        <input id="savWithdraw" type="checkbox" checked={withdraw} onChange={(e) => setWithdraw(e.target.checked)} className="w-[17px] h-[17px] accent-accent shrink-0" />
        <span className="text-[13px]">To wypłata (odejmij od oszczędności)</span>
      </label>
      <SaveButton busy={busy} onClick={handleSave} label={editing ? "Zapisz zmiany" : "Zapisz"} />
    </>
  );
}

function EditInitialForm({ zd, onClose }: { zd: ReturnType<typeof useZoneData>; onClose: () => void }) {
  const { busy, save } = useSaver(onClose);
  const [value, setValue] = useState(String(zd.savingsInitial || 0));

  function handleSave() {
    save(() => zd.setSavingsInitial(parseFloat(value) || 0), "Zapisano stan początkowy");
  }

  return (
    <>
      <SheetHeader title="Stan początkowy oszczędności" onClose={onClose} />
      <Field label="Stan początkowy" htmlFor="initialAmount" hint="Kwota, od której zaczynasz liczyć oszczędności w tej aplikacji.">
        <input id="initialAmount" type="number" min={0} step={0.01} value={value} onChange={(e) => setValue(e.target.value)} className={inputClass} />
      </Field>
      <SaveButton busy={busy} onClick={handleSave} label="Zapisz" />
    </>
  );
}

// ---------- monthly budgets ----------
function BudgetsForm({ zd, onClose }: { zd: ReturnType<typeof useZoneData>; onClose: () => void }) {
  const { busy, save } = useSaver(onClose);
  const categories = useCategories();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(zd.budgets.map((b) => [b.category, String(b.amount)]))
  );

  function handleSave() {
    const limits = Object.fromEntries(
      Object.entries(values).map(([category, raw]) => [category, parseFloat(raw) || 0])
    );
    save(() => zd.saveBudgets(limits), "Zapisano budżety");
  }

  return (
    <>
      <SheetHeader title="Miesięczne budżety" onClose={onClose} />
      <div className="text-[12.5px] text-ink-muted -mt-1">
        Limit na kategorię, obowiązuje w każdym miesiącu. Zostaw puste, żeby nie śledzić kategorii.
      </div>
      <div className="flex flex-col gap-2">
        {categories.map((c) => (
          <label key={c.name} htmlFor={`budget-${c.name}`} className="flex items-center gap-2.5">
            <span className="text-[17px] w-6 text-center shrink-0">{c.icon}</span>
            <span className="flex-1 text-[13px] font-medium truncate">{c.name}</span>
            <input
              id={`budget-${c.name}`}
              type="number"
              min={0}
              step={1}
              inputMode="decimal"
              value={values[c.name] ?? ""}
              onChange={(e) => setValues((prev) => ({ ...prev, [c.name]: e.target.value }))}
              placeholder="brak"
              className={inputClass + " w-28 text-right py-2"}
            />
          </label>
        ))}
      </div>
      <SaveButton busy={busy} onClick={handleSave} label="Zapisz budżety" />
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
  const { showToast } = useToast();
  const ops = kind === "income" ? zd.recurringIncomeOps : zd.recurringExpenseOps;
  const expenseTpl = kind === "expense" ? zd.recurring.find((r) => r.id === templateId) : undefined;
  const incomeTpl = kind === "income" ? zd.recurringIncomes.find((r) => r.id === templateId) : undefined;
  const tpl = expenseTpl ?? incomeTpl;
  if (!tpl) return null;

  const label = expenseTpl ? expenseTpl.desc || expenseTpl.category : incomeTpl!.desc || INCOME_TYPE_LABELS[incomeTpl!.type];
  const noun = kind === "income" ? "Zarobek stały" : "Wydatek stały";
  const deletesWhole = month <= tpl.start_month;

  async function handleSkip() {
    await ops.skip(templateId, month);
    onClose();
    showToast(`Pominięto w miesiącu ${monthLabel(month)}`, () => ops.undoSkip(templateId, month));
  }

  async function handleDisable() {
    const result = await ops.disableFrom(templateId, month);
    onClose();
    if (!result) return;
    showToast(
      result.deleted
        ? `Usunięto: ${label}`
        : `Wyłączono od ${monthLabelGenitive(month)} — wcześniejsze miesiące bez zmian`,
      result.undo
    );
  }

  return (
    <>
      <SheetHeader title={label} onClose={onClose} />
      <div className="text-[12.5px] text-ink-muted">
        {noun} — {fmt(tpl.amount)} co miesiąc. Wybierz, co zrobić z {monthLabel(month)}.
      </div>
      <button type="button" onClick={handleSkip} className="font-semibold text-[13px] text-accent bg-accent-soft border-none rounded-md py-2.5">
        Pomiń tylko {monthLabel(month)}
      </button>
      <button type="button" onClick={handleDisable} className="font-semibold text-[13px] text-critical bg-critical-soft border-none rounded-md py-2.5 mb-1">
        {deletesWhole
          ? `Usuń całkowicie (zaczynał się w ${monthLabel(month)})`
          : `Wyłącz od ${monthLabelGenitive(month)} (wcześniejsze miesiące zostają)`}
      </button>
    </>
  );
}
