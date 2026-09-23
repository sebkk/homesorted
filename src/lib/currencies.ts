// Currencies with an NBP mid rate. NBP quotes everything against PLN:
// table A is published every business day, table B once a week (Wednesdays).
export const NBP_TABLE: Record<string, "A" | "B"> = {
  EUR: "A", USD: "A", GBP: "A", AUD: "A", UAH: "A", CHF: "A", CAD: "A", NZD: "A",
  CZK: "A", DKK: "A", NOK: "A", SEK: "A", HUF: "A", RON: "A", ISK: "A", TRY: "A",
  ILS: "A", JPY: "A", CNY: "A", HKD: "A", SGD: "A", KRW: "A", INR: "A", IDR: "A",
  MYR: "A", PHP: "A", THB: "A", MXN: "A", BRL: "A", CLP: "A", ZAR: "A",
  RUB: "B",
};

/** Pinned first, then the rest alphabetically. */
const PINNED = ["PLN", "EUR", "USD", "GBP", "AUD", "UAH", "RUB"];
export const CURRENCIES: string[] = [
  ...PINNED,
  ...Object.keys(NBP_TABLE).filter((c) => !PINNED.includes(c)).sort(),
];

export function isSupportedCurrency(code: string): boolean {
  return code === "PLN" || code in NBP_TABLE;
}

export function currencyName(code: string, locale = "pl-PL"): string {
  try {
    return new Intl.DisplayNames([locale], { type: "currency" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function currencySymbol(code: string, locale = "pl-PL"): string {
  const part = new Intl.NumberFormat(locale, { style: "currency", currency: code, currencyDisplay: "narrowSymbol" })
    .formatToParts(0)
    .find((p) => p.type === "currency");
  return part?.value ?? code;
}
