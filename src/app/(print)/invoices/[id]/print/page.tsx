import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getAuthUser, HttpError } from "@/lib/session";
import { getInvoice } from "@/modules/platform/service";
import { InvoiceDocument } from "@/components/invoices/invoice-document";
import { PrintOnLoad } from "@/components/invoices/print-on-load";

export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getAuthUser();
  if (!actor) redirect("/login");
  const { id } = await params;
  try {
    const invoice = await getInvoice(id);
    return (
      <div className="mx-auto max-w-[720px] py-8">
        <Suspense fallback={null}>
          <PrintOnLoad />
        </Suspense>
        <InvoiceDocument invoice={invoice} />
      </div>
    );
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
}
