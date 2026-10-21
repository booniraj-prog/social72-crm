import { formatInr2 } from "@/lib/money";
import { formatIstDate } from "@/lib/time";

export type InvoicePdfInput = {
  number: string;
  kind: string;
  status: string;
  issueDate: string;
  dueDate: string | null;
  notes: string | null;
  subtotal: number;
  gstPct: number;
  total: number;
  paid: number;
  outstanding: number;
  discountAmt?: number;
  discountPct?: number;
  gross?: number;
  client: {
    name: string;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    gstin: string | null;
  };
  engagement: { name: string } | null;
  lines: Array<{ description: string; qty: number; rate: number; amount: number }>;
};

const KIND_LABEL: Record<string, string> = {
  QUOTE: "QUOTATION",
  PROFORMA: "PROFORMA INVOICE",
  INVOICE: "TAX INVOICE",
  CREDIT_NOTE: "CREDIT NOTE",
  DEBIT_NOTE: "DEBIT NOTE",
};

export function invoiceKindLabel(kind: string) {
  return KIND_LABEL[kind] ?? kind;
}

export function invoiceShareText(inv: InvoicePdfInput) {
  return [
    `${invoiceKindLabel(inv.kind)} ${inv.number}`,
    `Bill to: ${inv.client.name}`,
    `Total: Rs. ${formatInr2(inv.total)}`,
    `Outstanding: Rs. ${formatInr2(inv.outstanding)}`,
    inv.dueDate ? `Due: ${formatIstDate(inv.dueDate)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
