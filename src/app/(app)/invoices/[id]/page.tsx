import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canDeleteRecords } from "@/lib/rbac";
import { canApprove } from "@/lib/approvals";
import { getAuthUser, HttpError } from "@/lib/session";
import { getInvoice } from "@/modules/platform/service";
import { InvoiceDocument } from "@/components/invoices/invoice-document";
import { InvoiceActions } from "@/components/invoices/invoice-actions";
import { AttachmentsPanel } from "@/components/platform/attachments-panel";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getAuthUser();
  if (!actor) redirect("/login");
  const { id } = await params;
  try {
    const invoice = await getInvoice(id);
    const approver = await canApprove(actor, invoice.kind === "QUOTE" ? "proposal" : "invoice");
    return (
      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">
              <Link href="/invoices" className="hover:text-copper">
                Invoices
              </Link>
            </p>
            <h1 className="mt-1 font-display text-3xl text-ink">{invoice.number}</h1>
            <p className="mt-1 text-sm text-ink-soft">
              {invoice.kind} for {invoice.client.name}
            </p>
          </div>
          <InvoiceActions
            canApprove={approver}
            canDelete={canDeleteRecords(actor)}
            invoice={{
              id: invoice.id,
              number: invoice.number,
              kind: invoice.kind,
              status: invoice.status,
              issueDate: invoice.issueDate,
              dueDate: invoice.dueDate,
              notes: invoice.notes,
              subtotal: invoice.subtotal,
              gstPct: invoice.gstPct,
              total: invoice.total,
              paid: invoice.paid,
              outstanding: invoice.outstanding,
              discountAmt: invoice.discountAmt,
              discountPct: invoice.discountPct,
              gross: invoice.gross,
              client: invoice.client,
              engagement: invoice.engagement,
              lines: invoice.lines,
            }}
          />
        </div>
        <div className="mt-6">
          <InvoiceDocument invoice={invoice} />
        </div>
        <AttachmentsPanel
          compact
          title="Attachments"
          canDelete={canDeleteRecords(actor)}
          defaults={{
            clientId: invoice.client.id,
            engagementId: invoice.engagement?.id,
            invoiceId: invoice.id,
          }}
          files={invoice.files}
          clients={[{ value: invoice.client.id, label: invoice.client.name }]}
          projects={invoice.engagement ? [{ value: invoice.engagement.id, label: invoice.engagement.name }] : []}
          invoices={[{ value: invoice.id, label: invoice.number }]}
          orders={[]}
        />
      </div>
    );
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
}
