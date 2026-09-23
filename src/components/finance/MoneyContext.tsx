"use client";

import { createContext, useContext, useMemo } from "react";
import { fmt as formatMoney } from "@/lib/finance";
import { currencySymbol } from "@/lib/currencies";
import { useIntlLocale } from "@/i18n/useFormat";

interface Money {
  /** The zone's currency; every sum and total is expressed in it. */
  currency: string;
  symbol: string;
  locale: string;
  /** Formats an amount in the zone's currency, or in `currency` if given. */
  fmt: (n: number, dec?: number, currency?: string) => string;
}

const MoneyContext = createContext<Money | null>(null);

export function MoneyProvider({ currency, children }: { currency: string; children: React.ReactNode }) {
  const locale = useIntlLocale();
  const value = useMemo<Money>(
    () => ({
      currency,
      locale,
      symbol: currencySymbol(currency, locale),
      fmt: (n, dec = 2, cur) => formatMoney(n, dec, cur ?? currency, locale),
    }),
    [currency, locale]
  );
  return <MoneyContext.Provider value={value}>{children}</MoneyContext.Provider>;
}

export function useMoney(): Money {
  const ctx = useContext(MoneyContext);
  if (!ctx) throw new Error("useMoney must be used within MoneyProvider");
  return ctx;
}
