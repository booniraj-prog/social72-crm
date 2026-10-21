import { formatInr2, round2 } from "@/lib/money";
import { formatIstDate } from "@/lib/time";
import { invoiceKindLabel } from "@/lib/invoice-format";
import { Social72Logo } from "@/components/brand/social72-logo";

export type InvoiceDocumentModel = {
  number: string;
  kind: string;
  status: string;
  issueDate: string;
  dueDate: string | null;
  notes: string | null;
  paymentTerms?: string | null;
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
  owner: { name: string | null; email: string | null } | null;
  lines: Array<{ id: string; description: string; qty: number; rate: number; amount: number }>;
};

export function InvoiceDocument({ invoice }: { invoice: InvoiceDocumentModel }) {
  const gst = round2(invoice.subtotal * (invoice.gstPct / 100));
  const half = round2(gst / 2);

  return (
    <article className="invoice-sheet mx-auto w-full max-w-[720px] bg-white p-8 text-ink shadow-sm sm:p-10">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6">
        <div>
          <Social72Logo className="h-9" />
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-ink-soft">Digital marketing &amp; technology</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.18em] text-copper">{invoiceKindLabel(invoice.kind)}</p>
          <p className="mt-1 font-display text-2xl">{invoice.number}</p>
          <p className="mt-1 text-sm text-ink-soft">{invoice.status}</p>
        </div>
      </header>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-ink-soft">Bill to</p>
          <p className="mt-1 font-medium">{invoice.client.name}</p>
          {invoice.client.contactName ? <p className="text-sm text-ink-soft">{invoice.client.contactName}</p> : null}
          {invoice.client.contactEmail ? <p className="text-sm text-ink-soft">{invoice.client.contactEmail}</p> : null}
          {invoice.client.contactPhone ? <p className="text-sm text-ink-soft">{invoice.client.contactPhone}</p> : null}
          {invoice.client.gstin ? <p className="text-sm text-ink-soft">GSTIN {invoice.client.gstin}</p> : null}
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-ink-soft">Issue date</dt>
          <dd className="text-right">{formatIstDate(invoice.issueDate)}</dd>
          <dt className="text-ink-soft">Due date</dt>
          <dd className="text-right">{formatIstDate(invoice.dueDate)}</dd>
          {invoice.engagement ? (
            <>
              <dt className="text-ink-soft">Project</dt>
              <dd className="text-right">{invoice.engagement.name}</dd>
            </>
          ) : null}
          {invoice.owner?.name ? (
            <>
              <dt className="text-ink-soft">Prepared by</dt>
              <dd className="text-right">{invoice.owner.name}</dd>
            </>
          ) : null}
        </dl>
      </div>

      <table className="mt-8 w-full text-sm">
        <thead>
          <tr className="border-y border-line bg-paper-2 text-left text-[10px] uppercase tracking-[0.14em] text-ink-soft">
            <th className="px-3 py-2 font-medium">Description</th>
            <th className="px-3 py-2 text-right font-medium">Qty</th>
            <th className="px-3 py-2 text-right font-medium">Rate</th>
            <th className="px-3 py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((line) => (
            <tr key={line.id} className="border-b border-line">
              <td className="px-3 py-2">{line.description}</td>
              <td className="px-3 py-2 text-right">{line.qty}</td>
              <td className="px-3 py-2 text-right">₹{formatInr2(line.rate)}</td>
              <td className="px-3 py-2 text-right">₹{formatInr2(line.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 ml-auto w-full max-w-xs space-y-1.5 text-sm">
        {invoice.gross && invoice.discountAmt ? <Row label="Gross" value={`₹${formatInr2(invoice.gross)}`} /> : null}
        {invoice.discountAmt ? <Row label={`Discount${invoice.discountPct ? ` (${invoice.discountPct}%)` : ""}`} value={`₹${formatInr2(invoice.discountAmt)}`} /> : null}
        <Row label="Taxable value" value={`₹${formatInr2(invoice.subtotal)}`} />
        <Row label={`CGST (${invoice.gstPct / 2}%)`} value={`₹${formatInr2(half)}`} />
        <Row label={`SGST (${invoice.gstPct / 2}%)`} value={`₹${formatInr2(half)}`} />
        <Row label="Total" value={`₹${formatInr2(invoice.total)}`} strong />
        <Row label="Paid" value={`₹${formatInr2(invoice.paid)}`} />
        <Row label="Balance due" value={`₹${formatInr2(invoice.outstanding)}`} strong />
      </div>

      {invoice.paymentTerms ? (
        <p className="mt-8 text-sm">
          <span className="font-medium">Payment terms. </span>
          {invoice.paymentTerms}
        </p>
      ) : null}

      {invoice.notes ? (
        <p className="mt-4 whitespace-pre-wrap text-sm text-ink-soft">
          <span className="font-medium text-ink">Notes. </span>
          {invoice.notes}
        </p>
      ) : null}

      <p className="mt-10 text-[11px] text-ink-soft">Computer-generated document. GST shown as intra-state CGST/SGST split.</p>
    </article>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-6 ${strong ? "font-medium" : ""}`}>
      <span className="text-ink-soft">{label}</span>
      <span>{value}</span>
    </div>
  );
}
