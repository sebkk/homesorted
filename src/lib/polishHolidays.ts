import { pad2 } from "./finance";

// Movable feasts (Easter Monday, Boże Ciało) are pinned to Easter Sunday via
// the anonymous Gregorian algorithm (Meeus/Jones/Butcher) — the only reliable
// way to derive them without a lookup table per year.
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

const holidayCache = new Map<number, Set<string>>();

/** All Polish statutory public holidays (dni ustawowo wolne od pracy) for a
 * given year, as "YYYY-MM-DD" strings. Includes Sunday-only feasts (Easter,
 * Zielone Świątki) for completeness even though they never affect working-day
 * counts. */
export function polishHolidaysInYear(year: number): Set<string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;

  const easter = easterSunday(year);
  const dates = [
    new Date(year, 0, 1), // Nowy Rok
    new Date(year, 0, 6), // Trzech Króli
    easter, // Wielkanoc
    addDays(easter, 1), // Poniedziałek Wielkanocny
    new Date(year, 4, 1), // Święto Pracy
    new Date(year, 4, 3), // Święto Konstytucji 3 Maja
    addDays(easter, 49), // Zielone Świątki
    addDays(easter, 60), // Boże Ciało
    new Date(year, 7, 15), // Wniebowzięcie NMP
    new Date(year, 10, 1), // Wszystkich Świętych
    new Date(year, 10, 11), // Narodowe Święto Niepodległości
    new Date(year, 11, 25), // Boże Narodzenie (I dzień)
    new Date(year, 11, 26), // Boże Narodzenie (II dzień)
  ];

  // Wigilia (24 grudnia) — 14. dzień ustawowo wolny od pracy od 2025 r.
  // (ustawa z 6.12.2024, w życiu od 1.02.2025 — pierwszy raz obowiązuje dla Wigilii 2025).
  if (year >= 2025) {
    dates.push(new Date(year, 11, 24));
  }

  const set = new Set(dates.map(toDateStr));
  holidayCache.set(year, set);
  return set;
}

export function isPolishHoliday(dateStr: string): boolean {
  const year = parseInt(dateStr.slice(0, 4), 10);
  return polishHolidaysInYear(year).has(dateStr);
}

/** Working days (Mon–Fri, minus Polish public holidays) in a "YYYY-MM" month. */
export function workingDaysInMonth(monthKey: string): number {
  const [yStr, mStr] = monthKey.split("-");
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  const daysInMonth = new Date(year, month, 0).getDate();
  const holidays = polishHolidaysInYear(year);

  let count = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const dow = new Date(year, month - 1, day).getDay(); // 0 = Sun, 6 = Sat
    if (dow === 0 || dow === 6) continue;
    if (holidays.has(`${yStr}-${mStr}-${pad2(day)}`)) continue;
    count++;
  }
  return count;
}

/** Standard full-time hours for a "YYYY-MM" month (working days × hours/day). */
export function standardWorkHours(monthKey: string, hoursPerDay = 8): number {
  return workingDaysInMonth(monthKey) * hoursPerDay;
}
