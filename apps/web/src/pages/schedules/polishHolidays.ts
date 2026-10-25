/** Stałe święta PL — zgodne z `polish_fixed_holiday` w API (+ ruchome: Wielkanoc). */

const FIXED: { month: number; day: number; name: string }[] = [
  { month: 1, day: 1, name: "Nowy Rok" },
  { month: 1, day: 6, name: "Trzech Króli" },
  { month: 5, day: 1, name: "Święto Pracy" },
  { month: 5, day: 3, name: "Święto Konstytucji 3 Maja" },
  { month: 8, day: 15, name: "Wniebowzięcie NMP" },
  { month: 11, day: 1, name: "Wszystkich Świętych" },
  { month: 11, day: 11, name: "Święto Niepodległości" },
  { month: 12, day: 25, name: "Boże Narodzenie" },
  { month: 12, day: 26, name: "Drugi dzień BN" },
];

function easterSunday(year: number): Date {
  // Meeus/Jones/Butcher
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

function addDaysLocal(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function keyOf(value: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

const movableCache = new Map<number, Map<string, string>>();

function movableForYear(year: number) {
  let map = movableCache.get(year);
  if (map) return map;
  map = new Map();
  const easter = easterSunday(year);
  map.set(keyOf(easter), "Wielkanoc");
  map.set(keyOf(addDaysLocal(easter, 1)), "Poniedziałek Wielkanocny");
  map.set(keyOf(addDaysLocal(easter, 60)), "Boże Ciało");
  movableCache.set(year, map);
  return map;
}

export function polishHolidayName(day: Date): string | null {
  const fixed = FIXED.find(
    (row) => row.month === day.getMonth() + 1 && row.day === day.getDate(),
  );
  if (fixed) return fixed.name;
  return movableForYear(day.getFullYear()).get(keyOf(day)) || null;
}
