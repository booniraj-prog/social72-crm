import { NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/session";
import { getInvoice } from "@/modules/platform/service";
import { buildInvoicePdf } from "@/lib/invoice-pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await params;
    const invoice = await getInvoice(id);
    const pdf = buildInvoicePdf(invoice);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.number}.pdf"`,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
