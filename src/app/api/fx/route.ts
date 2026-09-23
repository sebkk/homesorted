import { NextResponse } from "next/server";
import { isSupportedCurrency, NBP_TABLE } from "@/lib/currencies";

// Converts entry currencies into a zone currency using NBP mid rates from the
// last table published BEFORE each date (the rule used for invoices in VAT/PIT).
// NBP quotes against PLN only, so any other pair is a cross rate:
//   rate(from -> to) = mid(from) / mid(to), with mid(PLN) = 1.

interface NbpRate {
  no: string;
  effectiveDate: string;
  mid: number;
}

const DAY = 86_400_000;
const LOOKBACK_DAYS = 21; // covers long holiday breaks and weekly table B
const MAX_ITEMS = 1000;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (date: string, days: number) => iso(new Date(new Date(date + "T00:00:00Z").getTime() + days * DAY));

async function fetchSeries(code: string, from: string, to: string): Promise<NbpRate[]> {
  const table = NBP_TABLE[code];
  const out: NbpRate[] = [];
  // Stay well inside NBP's per-request range limit.
  for (let start = from; start <= to; start = addDays(start, 360)) {
    const end = addDays(start, 359) < to ? addDays(start, 359) : to;
    const res = await fetch(
      `https://api.nbp.pl/api/exchangerates/rates/${table}/${code}/${start}/${end}/?format=json`,
      { next: { revalidate: 86_400 } }
    );
    if (res.status === 404) continue; // no table published in that window
    if (!res.ok) throw new Error(`NBP ${code} ${res.status}`);
    const json = (await res.json()) as { rates: NbpRate[] };
    out.push(...json.rates);
  }
  return out.sort((a, b) => (a.effectiveDate < b.effectiveDate ? -1 : 1));
}

/** Last published rate strictly before `date`. */
function rateBefore(series: NbpRate[], date: string): NbpRate | null {
  let found: NbpRate | null = null;
  for (const r of series) {
    if (r.effectiveDate < date) found = r;
    else break;
  }
  return found;
}

export async function POST(req: Request) {
  let body: { to?: string; items?: { currency: string; date: string }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const to = body.to ?? "PLN";
  const items = body.items ?? [];
  if (!isSupportedCurrency(to) || items.length > MAX_ITEMS) {
    return NextResponse.json({ error: "unsupported request" }, { status: 400 });
  }
  if (items.some((i) => !isSupportedCurrency(i.currency) || !/^\d{4}-\d{2}-\d{2}$/.test(i.date))) {
    return NextResponse.json({ error: "unsupported currency or bad date" }, { status: 400 });
  }

  const codes = new Set(items.map((i) => i.currency));
  codes.add(to);
  codes.delete("PLN");
  const dates = items.map((i) => i.date).sort();
  const from = addDays(dates[0] ?? iso(new Date()), -LOOKBACK_DAYS);
  // NBP rejects ranges that end in the future; a future-dated entry simply
  // gets the latest published rate.
  const today = iso(new Date());
  const lastNeeded = addDays(dates[dates.length - 1] ?? today, -1);
  const until = lastNeeded < today ? lastNeeded : today;

  try {
    const series = new Map<string, NbpRate[]>();
    await Promise.all([...codes].map(async (c) => series.set(c, await fetchSeries(c, from, until))));

    const result: Record<string, { rate: number; date: string | null; table: string | null } | null> = {};
    for (const { currency, date } of items) {
      const key = `${currency}@${date}`;
      if (currency === to) {
        result[key] = { rate: 1, date: null, table: null };
        continue;
      }
      const fromRate = currency === "PLN" ? null : rateBefore(series.get(currency) ?? [], date);
      const toRate = to === "PLN" ? null : rateBefore(series.get(to) ?? [], date);
      if ((currency !== "PLN" && !fromRate) || (to !== "PLN" && !toRate)) {
        result[key] = null;
        continue;
      }
      const midFrom = fromRate?.mid ?? 1;
      const midTo = toRate?.mid ?? 1;
      result[key] = {
        rate: Math.round((midFrom / midTo) * 1e6) / 1e6,
        date: (fromRate ?? toRate)!.effectiveDate,
        table: [...new Set([fromRate?.no, toRate?.no].filter(Boolean))].join("; "),
      };
    }
    return NextResponse.json({ rates: result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "NBP error" }, { status: 502 });
  }
}
