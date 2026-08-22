const IST = "Asia/Kolkata";

function ymdInIst(date: Date) {
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
