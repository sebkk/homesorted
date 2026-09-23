"use client";

import { useState } from "react";
import { useZoneData } from "@/lib/useZoneData";
import { fmt, monthLabel, todayStr } from "@/lib/finance";
import { CATEGORIES, IncomeType, INCOME_TYPE_LABELS } from "@/lib/types";
import { Sheet, SheetHeader, Field } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";

export type SheetState =
  | { type: "income" }
  | { type: "expense" }
  | { type: "savings" }
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
      {sheet?.type === "expense" && <ExpenseForm zd={zd} currentMonth={currentMonth} onClose={onClose} />}
      {sheet?.type === "savings" && <SavingsForm zd={zd} onClose={onClose} />}
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
}: {
  zd: ReturnType<typeof useZoneData>;
  currentMonth: string;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const [type, setType] = useState<IncomeType>("b2b");
  const [month, setMonth] = useState(currentMonth);
  const [hours, setHours] = useState("");
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [applyVat, setApplyVat] = useState(false);

  const baseAmount = parseFloat(amount) || 0;
  const finalAmount = type === "b2b" && applyVat ? baseAmount * 1.23 : baseAmount;

  async function handleSave() {
    if (baseAmount <= 0) return;
    const error = await zd.addIncome({
      month,
      type,
      hours: parseFloat(hours) || 0,
      amount: finalAmount,
      desc: desc.trim(),
    });
    if (!error) {
      onClose();
      showToast("Dodano zarobek");
    }
  }

  return (
    <>
      <SheetHeader title="Nowy zarobek" onClose={onClose} />
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
          <input id="incHours" type="number" min={0} step={1} value={hours} onChange={(e) => setHours(e.target.value)} className={inputClass} placeholder="0" />
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
      {type === "b2b" && (
        <label className="flex flex-row items-center gap-2.5" htmlFor="incVat">
          <input id="incVat" type="checkbox" checked={applyVat} onChange={(e) => setApplyVat(e.target.checked)} className="w-[17px] h-[17px] accent-accent shrink-0" />
          <span className="text-[13px]">Doliczyć VAT 23%</span>
        </label>
      )}
      {type === "b2b" && applyVat && baseAmount > 0 && (
        <div className="text-[12px] text-ink-muted">Kwota brutto: {fmt(finalAmount)}</div>
      )}
      <button type="button" onClick={handleSave} className="font-bold text-[14.5px] text-accent-ink bg-accent rounded-md py-3 mb-1">
        Zapisz
      </button>
    </>
  );
}

// ---------- expense ----------
function ExpenseForm({
  zd,
  currentMonth,
  onClose,
}: {
  zd: ReturnType<typeof useZoneData>;
  currentMonth: string;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [isRecurring, setIsRecurring] = useState(false);
  const [dayOfMonth, setDayOfMonth] = useState("1");

  async function handleSave() {
    const value = parseFloat(amount) || 0;
    if (value <= 0) return;

    if (isRecurring) {
      const error = await zd.addRecurring({
        category,
        desc: desc.trim(),
        amount: value,
        day_of_month: parseInt(dayOfMonth, 10) || 1,
        start_month: currentMonth,
      });
      if (!error) {
        onClose();
        showToast("Dodano wydatek stały");
      }
      return;
    }

    const error = await zd.addExpense({ date, category, desc: desc.trim(), amount: value });
    if (!error) {
      onClose();
      showToast("Dodano wydatek");
    }
  }

  return (
    <>
      <SheetHeader title="Nowy wydatek" onClose={onClose} />
      <Field label="Kategoria" htmlFor="expCategory">
        <select id="expCategory" value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
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

      <label className="flex flex-row items-center gap-2.5" htmlFor="expRecurring">
        <input id="expRecurring" type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="w-[17px] h-[17px] accent-accent shrink-0" />
        <span className="text-[13px]">To wydatek stały (co miesiąc)</span>
      </label>

      {isRecurring ? (
        <Field label="Dzień miesiąca" htmlFor="expDay" hint={`Wydatek stały zacznie obowiązywać od ${monthLabel(currentMonth)}.`}>
          <input id="expDay" type="number" min={1} max={28} value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} className={inputClass} />
        </Field>
      ) : (
        <Field label="Data" htmlFor="expDate">
          <input id="expDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </Field>
      )}

      <button type="button" onClick={handleSave} className="font-bold text-[14.5px] text-accent-ink bg-accent rounded-md py-3 mb-1">
        Zapisz
      </button>
    </>
  );
}

// ---------- savings ----------
function SavingsForm({ zd, onClose }: { zd: ReturnType<typeof useZoneData>; onClose: () => void }) {
  const { showToast } = useToast();
  const [date, setDate] = useState(todayStr());
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [withdraw, setWithdraw] = useState(false);

  async function handleSave() {
    const value = parseFloat(amount) || 0;
    if (value <= 0) return;
    const error = await zd.addSavingsEntry({ date, desc: desc.trim(), amount: withdraw ? -value : value });
    if (!error) {
      onClose();
      showToast("Zapisano");
    }
  }

  return (
    <>
      <SheetHeader title="Dodaj do oszczędności" onClose={onClose} />
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
        Zapisz
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
