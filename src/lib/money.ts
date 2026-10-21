export function formatInr(value: number) {
  const n = Math.round(Number(value || 0));
  const sign = n < 0 ? "-" : "";
  const digits = String(Math.abs(n));
  if (digits.length <= 3) return `${sign}${digits}`;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${sign}${rest},${last3}`;
}

export function formatInr2(value: number) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function safeDiv(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return numerator / denominator;
}

export function pct(numerator: number, denominator: number) {
  return Math.round(safeDiv(numerator, denominator) * 1000) / 10;
}

export function round2(value: number) {
  return Math.round(value * 100) / 100;
}
