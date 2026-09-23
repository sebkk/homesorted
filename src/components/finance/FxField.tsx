"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CURRENCIES, currencyName } from "@/lib/currencies";
import { useMoney } from "@/components/finance/MoneyContext";
import { Field } from "@/components/ui/Sheet";

interface Quote {
  key: string;
  rate: number | null; // null = NBP has no rate for that date/currency
  date: string | null;
  table: string | null;
}

/** fx_table value for a rate typed in by the user ("ręcznie" in older rows). */
export const MANUAL_FX_TABLE = "manual";
const isManualTable = (table: string | null) => table === MANUAL_FX_TABLE || table === "ręcznie";

export interface FxInitial {
  currency: string;
  fx_rate: number;
  fx_date: string | null;
  fx_table: string | null;
}

async function fetchQuote(currency: string, to: string, date: string) {
  const res = await fetch("/api/fx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, items: [{ currency, date }] }),
  });
  if (!res.ok) throw new Error("NBP");
  const json = (await res.json()) as { rates: Record<string, { rate: number; date: string | null; table: string | null } | null> };
  return json.rates[`${currency}@${date}`] ?? null;
}

/**
 * Currency + NBP rate for one entry. The rate converts the entry's amount into
 * the zone's currency and is taken from the last NBP table before `date`.
 * Editing an entry keeps its saved rate until currency or date changes; the
 * user can also type a rate by hand (e.g. their bank's actual rate).
 */
export function useFx(date: string, initial?: FxInitial) {
  const { currency: zoneCurrency } = useMoney();
  const [currency, setCurrency] = useState(initial?.currency ?? zoneCurrency);
  const [manualRate, setManualRate] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);

  const foreign = currency !== zoneCurrency;
  const key = `${currency}@${date}@${zoneCurrency}`;
  const initialKey = initial ? `${initial.currency}@${date}@${zoneCurrency}` : null;
  const usesSaved = !!initial && key === initialKey && initial.currency !== zoneCurrency;
  const needsFetch = foreign && manualRate === null && !usesSaved && !!date;

  useEffect(() => {
    if (!needsFetch) return;
    let cancelled = false;
    fetchQuote(currency, zoneCurrency, date)
      .then((q) => !cancelled && setQuote({ key, rate: q?.rate ?? null, date: q?.date ?? null, table: q?.table ?? null }))
      .catch(() => !cancelled && setQuote({ key, rate: null, date: null, table: null }));
    return () => {
      cancelled = true;
    };
  }, [needsFetch, currency, zoneCurrency, date, key]);

  const fetched = quote?.key === key ? quote : null;
  const parsedManual = manualRate !== null ? parseFloat(manualRate.replace(",", ".")) : NaN;

  let rate: number | null;
  let meta: { date: string | null; table: string | null };
  if (!foreign) {
    rate = 1;
    meta = { date: null, table: null };
  } else if (manualRate !== null) {
    rate = parsedManual > 0 ? parsedManual : null;
    meta = { date: null, table: MANUAL_FX_TABLE };
  } else if (usesSaved) {
    rate = initial!.fx_rate;
    meta = { date: initial!.fx_date, table: initial!.fx_table };
  } else {
    rate = fetched?.rate ?? null;
    meta = { date: fetched?.date ?? null, table: fetched?.table ?? null };
  }

  return {
    currency,
    setCurrency: (c: string) => {
      setCurrency(c);
      setManualRate(null);
    },
    zoneCurrency,
    foreign,
    rate,
    meta,
    loading: needsFetch && !fetched,
    failed: needsFetch && !!fetched && fetched.rate === null,
    manualRate,
    setManualRate,
    /** Columns to save alongside the amount; null while the rate is unknown. */
    fields: rate === null ? null : { currency, fx_rate: rate, fx_date: meta.date, fx_table: meta.table },
  };
}

export type Fx = ReturnType<typeof useFx>;

const inputClass =
  "text-[14.5px] font-medium text-ink bg-sheet-field-bg border border-border rounded-md px-3 py-2.5 outline-none focus:border-accent tabular-nums";

export function AmountWithCurrency({
  id,
  label,
  amount,
  setAmount,
  fx,
  hint,
}: {
  id: string;
  label: string;
  amount: string;
  setAmount: (v: string) => void;
  fx: Fx;
  hint?: string;
}) {
  const t = useTranslations("fx");
  const { fmt, locale } = useMoney();
  const value = parseFloat(amount) || 0;

  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <div className="flex flex-row gap-2 items-center">
        <input
          id={id}
          type="number"
          min={0}
          step={0.01}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={inputClass + " flex-1 min-w-0"}
          placeholder="0"
        />
        <select
          id={`${id}Currency`}
          aria-label={t("currency")}
          value={fx.currency}
          onChange={(e) => fx.setCurrency(e.target.value)}
          className={inputClass + " w-[88px] shrink-0"}
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c} title={currencyName(c, locale)}>
              {c}
            </option>
          ))}
        </select>
      </div>
      {fx.foreign && (
        <div className="text-[11.5px] font-normal text-ink-muted mt-1 flex flex-col gap-1">
          {fx.loading && <span>{t("loading")}</span>}
          {fx.failed && <span className="text-critical">{t("missing")}</span>}
          {fx.rate !== null && (
            <span className="tabular-nums">
              1 {fx.currency} = {fx.rate.toLocaleString(locale, { maximumFractionDigits: 6 })} {fx.zoneCurrency}
              {fx.meta.table && !isManualTable(fx.meta.table) && (
                <> · NBP {fx.meta.table}{fx.meta.date ? `, ${fx.meta.date}` : ""}</>
              )}
              {isManualTable(fx.meta.table) && <> · {t("manualNote")}</>}
              {value > 0 && <> · ≈ {fmt(value * fx.rate, 2)}</>}
            </span>
          )}
          <label className="flex items-center gap-2" htmlFor={`${id}Rate`}>
            <span>{t("manualLabel")}</span>
            <input
              id={`${id}Rate`}
              type="text"
              inputMode="decimal"
              value={fx.manualRate ?? ""}
              onChange={(e) => fx.setManualRate(e.target.value === "" ? null : e.target.value)}
              placeholder={t("manualPlaceholder")}
              className={inputClass + " w-28 py-1.5 text-[13px]"}
            />
          </label>
        </div>
      )}
    </Field>
  );
}
