export const LOCALES = ["pl", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "pl";
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** BCP 47 tag used for Intl number/date formatting. */
export const INTL_LOCALE: Record<Locale, string> = { pl: "pl-PL", en: "en-GB" };

export function toLocale(value: string | undefined): Locale {
  return (LOCALES as readonly string[]).includes(value ?? "") ? (value as Locale) : DEFAULT_LOCALE;
}
