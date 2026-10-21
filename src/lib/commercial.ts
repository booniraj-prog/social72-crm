export function paymentStatus(input: {
  total: number;
  paid: number;
  dueDate?: string | Date | null;
  status?: string | null;
}) {
  const status = (input.status ?? "").toUpperCase();
  if (status === "VOID" || status === "DRAFT" || status === "REJECTED") return status === "DRAFT" ? "Draft" : status === "VOID" ? "Void" : "Rejected";
  const outstanding = Number(input.total ?? 0) - Number(input.paid ?? 0);
  if (outstanding <= 1) return "Paid";
  const due = input.dueDate ? new Date(input.dueDate) : null;
  if (due && !Number.isNaN(due.getTime()) && due < new Date()) return "Overdue";
  if (Number(input.paid ?? 0) > 0) return "Partial";
  return "Due";
}

export function poPaymentStatus(input: { value: number; billed: number; collected: number }) {
  const value = Number(input.value ?? 0);
  const billed = Number(input.billed ?? 0);
  const collected = Number(input.collected ?? 0);
  if (value <= 0) return "Open";
  if (collected >= value - 1) return "Paid";
  if (collected > 0) return "Partial";
  if (billed >= value - 1) return "Billed";
  if (billed > 0) return "Partial billed";
  return "Open";
}

export function vsBench(amount: number, bench: number) {
  if (!bench || bench <= 0) return "—";
  const pct = Math.round((amount / bench) * 1000) / 10;
  return `${pct}% of bench`;
}
