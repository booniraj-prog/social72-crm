const IST = "Asia/Kolkata";

export function ymdInIst(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "01";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function startOfIstDay(date = new Date()) {
  return new Date(`${ymdInIst(date)}T00:00:00+05:30`);
}

export function addIstDays(date: Date, days: number) {
  const next = new Date(startOfIstDay(date).getTime() + days * 24 * 60 * 60 * 1000);
  return startOfIstDay(next);
}

export function istRange(kind: "today" | "tomorrow" | "overdue" | "upcoming") {
  const today = startOfIstDay();
  const tomorrow = addIstDays(today, 1);
  const dayAfter = addIstDays(today, 2);
  if (kind === "today") return { gte: today, lt: tomorrow };
  if (kind === "tomorrow") return { gte: tomorrow, lt: dayAfter };
  if (kind === "overdue") return { lt: today };
  return { gte: dayAfter };
}

export function formatIst(iso: string | Date | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: IST,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatIstDate(iso: string | Date | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    timeZone: IST,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function istPart(date: Date, type: Intl.DateTimeFormatPartTypes) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return parts.find((p) => p.type === type)?.value ?? "";
}

/** Value for `<input type="datetime-local">` in IST, independent of the browser zone. */
export function toIstDatetimeLocal(iso: string | Date | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${istPart(date, "year")}-${istPart(date, "month")}-${istPart(date, "day")}T${istPart(date, "hour")}:${istPart(date, "minute")}`;
}

/** Parse a datetime-local string as IST (not the browser timezone). */
export function fromIstDatetimeLocal(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const stamp = trimmed.length === 16 ? `${trimmed}:00` : trimmed;
  const date = new Date(`${stamp}+05:30`);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export function defaultIstCallbackLocal() {
  const tomorrow = addIstDays(new Date(), 1);
  return toIstDatetimeLocal(new Date(`${ymdInIst(tomorrow)}T10:00:00+05:30`));
}

export function toIstDateInput(iso: string | Date | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${istPart(date, "year")}-${istPart(date, "month")}-${istPart(date, "day")}`;
}

export function fromIstDateInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const date = new Date(`${trimmed}T00:00:00+05:30`);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

export const DASHBOARD_PERIODS = ["today", "week", "month", "quarter", "year"] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export function istPeriodRange(period: DashboardPeriod): { from: string; to: string } {
  const today = startOfIstDay();
  const to = ymdInIst(today);
  if (period === "today") return { from: to, to };
  if (period === "week") return { from: ymdInIst(addIstDays(today, -6)), to };
  if (period === "month") {
    const ymd = ymdInIst(today);
    return { from: `${ymd.slice(0, 8)}01`, to };
  }
  if (period === "quarter") {
    const ymd = ymdInIst(today);
    const month = Number(ymd.slice(5, 7));
    const qStart = month <= 3 ? "01" : month <= 6 ? "04" : month <= 9 ? "07" : "10";
    return { from: `${ymd.slice(0, 5)}${qStart}-01`, to };
  }
  return { from: `${ymdInIst(today).slice(0, 4)}-01-01`, to };
}
