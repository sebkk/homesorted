"use client";

import { useEffect, useState } from "react";
import { useZoneData } from "@/lib/useZoneData";
import { useCategories } from "@/lib/useCategories";
import { daysInMonth, fmt, monthLabel, monthLabelGenitive, nextMonth, prevMonth, todayStr } from "@/lib/finance";
import { standardWorkHours, workingDaysInMonth } from "@/lib/polishHolidays";
import { Expense, Income, IncomeType, INCOME_TYPE_ICONS, INCOME_TYPE_LABELS, RecurringExpense, SavingsEntry } from "@/lib/types";
import { Sheet, SheetHeader, Field } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";

export type SheetState =
  | { type: "income" }
  | { type: "editIncome"; income: Income }
  | { type: "expense" }
  | { type: "editExpense"; expense: Expense }
  | { type: "editRecurring"; recurring: RecurringExpense }
  | { type: "savings" }
  | { type: "editSavings"; entry: SavingsEntry }
  | { type: "editInitial" }
  | { type: "recurringMenu"; templateId: string; month: string }
  | null;

const inputClass =
  "text-[14.5px] font-medium text-ink bg-sheet-field-bg border border-border rounded-md px-3 py-2.5 outline-none focus:border-accent tabular-nums";

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
      {sheet?.type === "savings" && <SavingsForm zd={zd} onClose={onClose} />}
      {sheet?.type === "editSavings" && <SavingsForm zd={zd} onClose={onClose} editing={sheet.entry} />}
      {sheet?.type === "editInitial" && <EditInitialForm zd={zd} onClose={onClose} />}
      {sheet?.type === "recurringMenu" && (
        <RecurringMenu zd={zd} templateId={sheet.templateId} month={sheet.month} onClose={onClose} />
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
}: {
  zd: ReturnType<typeof useZoneData>;
  currentMonth: string;
  onClose: () => void;
  editing?: Income;
}) {
  const { showToast } = useToast();
  const [type, setType] = useState<IncomeType>(editing?.type ?? "b2b");
  const [month, setMonth] = useState(editing?.month ?? currentMonth);
  const [hours, setHours] = useState(editing ? String(editing.hours) : "");
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [desc, setDesc] = useState(editing?.desc ?? "");
  const [applyVat, setApplyVat] = useState(false);
  const [icon, setIcon] = useState(editing?.icon ?? "");

  const baseAmount = parseFloat(amount) || 0;
  const finalAmount = !editing && type === "b2b" && applyVat ? baseAmount * 1.23 : baseAmount;

  async function handleSave() {
    if (baseAmount <= 0) return;

    if (editing) {
      const error = await zd.updateIncome(editing.id, {
        month,
        type,
        hours: parseFloat(hours) || 0,
        amount: baseAmount,
        desc: desc.trim(),
        icon: icon.trim() || null,
      });
      if (!error) {
        onClose();
        showToast("Zapisano zmiany");
      }
      return;
    }

    const error = await zd.addIncome({
      month,
      type,
      hours: parseFloat(hours) || 0,
      amount: finalAmount,
      desc: desc.trim(),
      icon: icon.trim() || null,
    });
    if (!error) {
      onClose();
      showToast("Dodano zarobek");
    }
  }

  return (
    <>
      <SheetHeader title={editing ? "Edytuj zarobek" : "Nowy zarobek"} onClose={onClose} />
      <Field label="Typ przychodu" htmlFor="incType">
        <select id="incType" value={type} onChange={(e) => setType(e.target.value as IncomeType)} className={inputClass}>
          {(Object.keys(INCOME_TYPE_LABELS) as IncomeType[]).map((t) => (
            <option key={t} value={t}>
              {INCOME_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Miesiąc" htmlFor="incMonth">
        <input id="incMonth" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={inputClass} />
      </Field>
      {type === "b2b" && (
        <Field label="Godziny (opcjonalnie)" htmlFor="incHours" hint="Do wyliczenia stawki zł/h na czysto.">
          <div className="flex flex-row gap-2 items-center">
            <input id="incHours" type="number" min={0} step={1} value={hours} onChange={(e) => setHours(e.target.value)} className={inputClass + " flex-1"} placeholder="0" />
            <button
              type="button"
              onClick={() => setHours(String(standardWorkHours(month)))}
              className="text-[12.5px] font-semibold text-accent bg-accent-soft rounded-md px-3 py-2.5 whitespace-nowrap"
            >
              Z dni roboczych
            </button>
          </div>
          <div className="text-[11.5px] text-ink-muted mt-1">
            {monthLabel(month)}: {workingDaysInMonth(month)} dni robocze (bez weekendów i świąt) × 8h = {standardWorkHours(month)} h
          </div>
        </Field>
      )}
      {type !== "b2b" && (
        <Field label="Opis (opcjonalnie)" htmlFor="incDesc">
          <input id="incDesc" type="text" value={desc} onChange={(e) => setDesc(e.target.value)} className={inputClass} placeholder="np. prezent od klienta" />
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
      {!editing && type === "b2b" && (
        <label className="flex flex-row items-center gap-2.5" htmlFor="incVat">
          <input id="incVat" type="checkbox" checked={applyVat} onChange={(e) => setApplyVat(e.target.checked)} className="w-[17px] h-[17px] accent-accent shrink-0" />
          <span className="text-[13px]">Doliczyć VAT 23%</span>
        </label>
      )}
      {!editing && type === "b2b" && applyVat && baseAmount > 0 && (
        <div className="text-[12px] text-ink-muted">Kwota brutto: {fmt(finalAmount)}</div>
      )}
      <button type="button" onClick={handleSave} className="font-bold text-[14.5px] text-accent-ink bg-accent rounded-md py-3 mb-1">
        {editing ? "Zapisz zmiany" : "Zapisz"}
      </button>
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
  const { showToast } = useToast();
  const categories = useCategories();
  const [category, setCategory] = useState<string>(editingExpense?.category ?? editingRecurring?.category ?? "");
  useEffect(() => {
    if (!category && categories.length > 0) setCategory(categories[0].name);
  }, [categories, category]);
  const [desc, setDesc] = useState(editingExpense?.desc ?? editingRecurring?.desc ?? "");
  const [amount, setAmount] = useState(
    editingExpense ? String(editingExpense.amount) : editingRecurring ? String(editingRecurring.amount) : ""
  );
  const [date, setDate] = useState(editingExpense?.date ?? todayStr());
  const [icon, setIcon] = useState(editingExpense?.icon ?? editingRecurring?.icon ?? "");
  const [isRecurring, setIsRecurring] = useState(!!editingRecurring);
  const [dayOfMonth, setDayOfMonth] = useState(editingRecurring ? String(editingRecurring.day_of_month) : "1");
  const [startMonth, setStartMonth] = useState(editingRecurring?.start_month ?? currentMonth);
  const [endMonth, setEndMonth] = useState(editingRecurring?.end_month ? prevMonth(editingRecurring.end_month) : ""); // last active month, inclusive; "" = no end
  const maxDay = daysInMonth(startMonth);
  const selectedCategoryIcon = categories.find((c) => c.name === category)?.icon ?? "📦";

  function handleStartMonthChange(value: string) {
    setStartMonth(value);
    if (parseInt(dayOfMonth, 10) > daysInMonth(value)) setDayOfMonth(String(daysInMonth(value)));
    if (endMonth && endMonth < value) setEndMonth(value);
  }

  function handleEndMonthChange(value: string) {
    setEndMonth(value && value < startMonth ? startMonth : value);
  }

  async function handleSave() {
    const value = parseFloat(amount) || 0;
    if (value <= 0) return;

    if (editingExpense) {
      const error = await zd.updateExpense(editingExpense.id, {
        date,
        category,
        desc: desc.trim(),
        amount: value,
        icon: icon.trim() || null,
      });
      if (!error) {
        onClose();
        showToast("Zapisano zmiany");
      }
      return;
    }

    if (editingRecurring) {
      const error = await zd.updateRecurring(editingRecurring.id, {
        category,
        desc: desc.trim(),
        amount: value,
        day_of_month: parseInt(dayOfMonth, 10) || 1,
        start_month: startMonth,
        end_month: endMonth ? nextMonth(endMonth) : null,
        icon: icon.trim() || null,
      });
      if (!error) {
        onClose();
        showToast("Zapisano zmiany");
      }
      return;
    }

    if (isRecurring) {
      const error = await zd.addRecurring({
        category,
        desc: desc.trim(),
        amount: value,
        day_of_month: parseInt(dayOfMonth, 10) || 1,
        start_month: startMonth,
        end_month: endMonth ? nextMonth(endMonth) : null,
        icon: icon.trim() || null,
      });
      if (!error) {
        onClose();
        showToast("Dodano wydatek stały");
      }
      return;
    }

    const error = await zd.addExpense({ date, category, desc: desc.trim(), amount: value, icon: icon.trim() || null });
    if (!error) {
      onClose();
      showToast("Dodano wydatek");
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
          <Field
            label="Obowiązuje od"
            htmlFor="expStartMonth"
            hint={
              startMonth < currentMonth
                ? `Doliczy się też do wcześniejszych miesięcy, od ${monthLabelGenitive(startMonth)}.`
                : `Wydatek stały zacznie obowiązywać od ${monthLabelGenitive(startMonth)}.`
            }
          >
            <input
              id="expStartMonth"
              type="month"
              value={startMonth}
              onChange={(e) => handleStartMonthChange(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field
            label="Do (opcjonalnie)"
            htmlFor="expEndMonth"
            hint={
              endMonth
                ? `Ostatni miesiąc: ${monthLabel(endMonth)}. Od ${monthLabelGenitive(nextMonth(endMonth))} wydatek już się nie doliczy.`
                : "Zostaw puste, żeby wydatek trwał bezterminowo."
            }
          >
            <div className="flex flex-row gap-2 items-center">
              <input
                id="expEndMonth"
                type="month"
                min={startMonth}
                value={endMonth}
                onChange={(e) => handleEndMonthChange(e.target.value)}
                className={inputClass + " flex-1"}
              />
              {endMonth && (
                <button
                  type="button"
                  onClick={() => setEndMonth("")}
                  className="text-[12.5px] font-semibold text-ink-muted bg-surface-2 rounded-md px-3 py-2.5 whitespace-nowrap"
                >
                  Usuń
                </button>
              )}
            </div>
          </Field>
        </>
      ) : (
        <Field label="Data" htmlFor="expDate">
          <input id="expDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </Field>
      )}

      <button type="button" onClick={handleSave} className="font-bold text-[14.5px] text-accent-ink bg-accent rounded-md py-3 mb-1">
        {editingExpense || editingRecurring ? "Zapisz zmiany" : "Zapisz"}
      </button>
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
  const { showToast } = useToast();
  const [date, setDate] = useState(editing?.date ?? todayStr());
  const [desc, setDesc] = useState(editing?.desc ?? "");
  const [amount, setAmount] = useState(editing ? String(Math.abs(editing.amount)) : "");
  const [withdraw, setWithdraw] = useState(editing ? editing.amount < 0 : false);

  async function handleSave() {
    const value = parseFloat(amount) || 0;
    if (value <= 0) return;
    const signedAmount = withdraw ? -value : value;

    if (editing) {
      const error = await zd.updateSavingsEntry(editing.id, { date, desc: desc.trim(), amount: signedAmount });
      if (!error) {
        onClose();
        showToast("Zapisano zmiany");
      }
      return;
    }

    const error = await zd.addSavingsEntry({ date, desc: desc.trim(), amount: signedAmount });
    if (!error) {
      onClose();
      showToast("Zapisano");
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
      <button type="button" onClick={handleSave} className="font-bold text-[14.5px] text-accent-ink bg-accent rounded-md py-3 mb-1">
        {editing ? "Zapisz zmiany" : "Zapisz"}
      </button>
    </>
  );
}

function EditInitialForm({ zd, onClose }: { zd: ReturnType<typeof useZoneData>; onClose: () => void }) {
  const { showToast } = useToast();
  const [value, setValue] = useState(String(zd.savingsInitial || 0));

  async function handleSave() {
    await zd.setSavingsInitial(parseFloat(value) || 0);
    onClose();
    showToast("Zapisano stan początkowy");
  }

  return (
    <>
      <SheetHeader title="Stan początkowy oszczędności" onClose={onClose} />
      <Field label="Stan początkowy" htmlFor="initialAmount" hint="Kwota, od której zaczynasz liczyć oszczędności w tej aplikacji.">
        <input id="initialAmount" type="number" min={0} step={0.01} value={value} onChange={(e) => setValue(e.target.value)} className={inputClass} />
      </Field>
      <button type="button" onClick={handleSave} className="font-bold text-[14.5px] text-accent-ink bg-accent rounded-md py-3 mb-1">
        Zapisz
      </button>
    </>
  );
}

// ---------- recurring skip / disable menu ----------
function RecurringMenu({
  zd,
  templateId,
  month,
  onClose,
}: {
  zd: ReturnType<typeof useZoneData>;
  templateId: string;
  month: string;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const tpl = zd.recurring.find((r) => r.id === templateId);
  if (!tpl) return null;

  async function handleSkip() {
    await zd.skipRecurringMonth(templateId, month);
    onClose();
    showToast(`Pominięto w miesiącu ${monthLabel(month)}`, () => zd.undoSkipRecurringMonth(templateId, month));
  }

  async function handleDisable() {
    const prevEnd = await zd.disableRecurringFrom(templateId, month);
    onClose();
    showToast(`Wyłączono od ${monthLabel(month)} — wcześniejsze miesiące bez zmian`, () =>
      zd.restoreRecurringEnd(templateId, prevEnd ?? null)
    );
  }

  return (
    <>
      <SheetHeader title={tpl.desc || tpl.category} onClose={onClose} />
      <div className="text-[12.5px] text-ink-muted">
        Wydatek stały — {fmt(tpl.amount)} co miesiąc. Wybierz, co zrobić z {monthLabel(month)}.
      </div>
      <button type="button" onClick={handleSkip} className="font-semibold text-[13px] text-accent bg-accent-soft border-none rounded-md py-2.5">
        Pomiń tylko {monthLabel(month)}
      </button>
      <button type="button" onClick={handleDisable} className="font-semibold text-[13px] text-critical bg-critical-soft border-none rounded-md py-2.5 mb-1">
        Wyłącz od {monthLabel(month)} (wcześniejsze miesiące zostają)
      </button>
    </>
  );
}
