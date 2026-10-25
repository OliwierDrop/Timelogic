export function startOfWeek(
  value: Date,
  weekStartsOn: "monday" | "sunday" = "monday",
) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay(); // 0=Sun … 6=Sat
  const offset =
    weekStartsOn === "sunday" ? day : (day + 6) % 7; // monday-based
  date.setDate(date.getDate() - offset);
  return date;
}

export function startOfMonth(value: Date) {
  const date = new Date(value.getFullYear(), value.getMonth(), 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

export function addMonths(value: Date, months: number) {
  return new Date(value.getFullYear(), value.getMonth() + months, 1);
}

export function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function toDateKey(value: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

export function parseDateKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function rangeLabel(mode: "week" | "month", start: Date) {
  if (mode === "month") {
    return new Intl.DateTimeFormat("pl-PL", {
      month: "long",
      year: "numeric",
    }).format(start);
  }
  const end = addDays(start, 6);
  const format = new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "short",
  });
  return `${format.format(start)} – ${format.format(end)}`;
}

export function daysInRange(mode: "week" | "month", start: Date) {
  if (mode === "week") {
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }
  const days: Date[] = [];
  const cursor = new Date(start);
  const month = start.getMonth();
  while (cursor.getMonth() === month) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function toLocalInput(value: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export function timeFromDate(value: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export function combineDateAndTime(day: Date, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const result = new Date(day);
  result.setHours(h || 0, m || 0, 0, 0);
  return result;
}

export const DAY_TYPE_LABELS: Record<string, string> = {
  P: "P",
  ND: "ND",
  SW: "ŚW",
  TP5: "5TP",
  HW: "HW",
};

export const KIND_LABELS = {
  standard: "Normowany",
  flexible: "Elastyczny",
  on_call: "Dyżur",
} as const;
