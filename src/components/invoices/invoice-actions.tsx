"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionIcon } from "@/components/ui/action-icon";
import { invoiceShareText, type InvoicePdfInput } from "@/lib/invoice-format";

export function InvoiceActions({
  invoice,
  canApprove,
  canDelete,
}: {
  invoice: InvoicePdfInput & { id: string };
  canApprove?: boolean;
  canDelete?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const printHref = `/invoices/${invoice.id}/print`;
  const pdfHref = `/api/invoices/${invoice.id}/pdf`;
  const pageHref = typeof window === "undefined" ? "" : window.location.href;
  const email = invoice.client.contactEmail ?? "";
  const phone = (invoice.client.contactPhone ?? "").replace(/\D/g, "");
  const body = invoiceShareText(invoice);
  const subject = encodeURIComponent(`${invoice.kind} ${invoice.number} — Social72`);
  const encodedBody = encodeURIComponent(body);

  async function copy(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 1600);
  }

  async function nativeShare() {
    const url = window.location.origin + `/invoices/${invoice.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${invoice.kind} ${invoice.number}`, text: body, url });
        return;
      } catch {
        /* user cancelled or unsupported payload */
      }
    }
    setOpen(true);
  }

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <ActionIcon action="preview" href={printHref} target="_blank" rel="noreferrer" />
      <ActionIcon action="print" onClick={() => window.open(`${printHref}?autoprint=1`, "_blank", "noopener")} />
      <ActionIcon action="pdf" label="Export PDF" href={pdfHref} />
      <ActionIcon action="share" onClick={nativeShare} />
      {canApprove && invoice.status === "DRAFT" ? (
        <>
          <ActionIcon
            action="approve"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await fetch("/api/platform?kind=invoice-decide", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: invoice.id, status: "SENT" }),
              });
              setBusy(false);
              router.refresh();
            }}
          />
          <ActionIcon
            action="reject"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await fetch("/api/platform?kind=invoice-decide", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: invoice.id, status: "VOID" }),
              });
              setBusy(false);
              router.refresh();
            }}
          />
        </>
      ) : null}
      {canDelete ? (
        <ActionIcon
          action="delete"
          disabled={busy}
          onClick={async () => {
            if (!window.confirm("Delete this document?")) return;
            setBusy(true);
            await fetch("/api/platform?kind=invoice-delete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: invoice.id }),
            });
            setBusy(false);
            router.push(invoice.kind === "QUOTE" ? "/proposals" : "/invoices");
          }}
        />
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-paper p-5">
            <h2 className="font-display text-xl">Share {invoice.number}</h2>
            <p className="mt-1 text-sm text-ink-soft">Send this invoice to the client or copy a link for your team.</p>
            <div className="mt-4 grid gap-2">
              <ActionIcon action="email" label={email ? `Email ${email}` : "Email"} href={`mailto:${email}?subject=${subject}&body=${encodedBody}`} />
              <ActionIcon action="whatsapp" href={`https://wa.me/${phone}?text=${encodedBody}`} target="_blank" rel="noreferrer" />
              <ActionIcon action="link" label="Copy CRM link" onClick={() => copy(pageHref || window.location.href, "link")} />
              <ActionIcon action="copy" label="Copy summary" onClick={() => copy(body, "summary")} />
            </div>
            {copied ? <p className="mt-2 text-sm text-pine">Copied {copied}.</p> : null}
            <div className="mt-4 flex justify-end">
              <ActionIcon action="close" onClick={() => setOpen(false)} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
