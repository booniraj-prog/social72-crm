import { redirect } from "next/navigation";
import { canDeleteRecords } from "@/lib/rbac";
import { getAuthUser } from "@/lib/session";
import { listClients } from "@/modules/clients/service";
import { listEngagements, listInvoices } from "@/modules/platform/service";
import { INVOICE_KINDS } from "@/modules/platform/constants";
import { formatInr } from "@/lib/money";
import { SimpleBoard } from "@/components/platform/simple-board";
import { ApprovalQueue } from "@/components/platform/approval-queue";
import { canApprove } from "@/lib/approvals";

export default async function InvoicesPage() {
  const actor = await getAuthUser();
  if (!actor) redirect("/login");
  const [all, clients, projects, approver] = await Promise.all([
    listInvoices(),
    listClients(),
    listEngagements(),
    canApprove(actor, "invoice"),
  ]);
  const rows = all.filter((r) => r.kind !== "QUOTE");
  const outstanding = rows.reduce((s, r) => s + r.outstanding, 0);
  const pending = rows.filter((r) => r.status === "DRAFT");
  return (
    <div>
      {approver ? (
        <ApprovalQueue
          title="Invoices awaiting approval"
          kind="invoice-decide"
          items={pending.map((r) => ({ id: r.id, title: r.number, meta: r.client.name }))}
        />
      ) : null}
      <SimpleBoard
      eyebrow="Finance"
      title="Invoices"
      summary="GST invoices on a client and project. Follow up payment status, due date and benchmark on the same row as collections."
      kind="invoice"
      rowHrefPrefix="/invoices"
      allowDelete={canDeleteRecords(actor)}
      documentActions
      kpis={[
        { label: "Awaiting approval", value: rows.filter((r) => r.status === "DRAFT").length },
        { label: "Outstanding", value: `₹${formatInr(outstanding)}` },
        { label: "Overdue", value: rows.filter((r) => r.payment === "Overdue").length },
      ]}
      columns={["number", "kind", "client", "project", "payment", "followUp", "total", "bench", "vsBench", "outstanding"]}
      rows={rows.map((r) => ({
        id: r.id,
        number: r.number,
        kind: r.kind,
        client: r.client.name,
        project: r.project,
        payment: r.payment,
        followUp: r.followUp,
        total: r.total,
        bench: r.bench ? `₹${formatInr(r.bench)}` : "—",
        outstanding: r.outstanding,
        vsBench: r.vsBench,
        history: r.history,
      }))}
      fields={[
        { name: "clientId", label: "Client", required: true, options: clients.map((c) => ({ value: c.id, label: c.name })) },
        {
          name: "engagementId",
          label: "Project",
          options: projects.map((p) => ({ value: p.id, label: `${p.name} · ${p.client.name}` })),
        },
        { name: "kind", label: "Type", options: INVOICE_KINDS.filter((s) => s !== "QUOTE").map((s) => ({ value: s, label: s })) },
        { name: "description", label: "Line description", required: true },
        { name: "amount", label: "Taxable amount", type: "number", required: true },
        { name: "benchmarkAmount", label: "Benchmark price", type: "number" },
        { name: "paid", label: "Collected so far", type: "number" },
        { name: "gstPct", label: "GST %", type: "number" },
        { name: "dueDate", label: "Due", type: "date" },
        { name: "followUpAt", label: "Payment follow-up", type: "date" },
        { name: "attachmentUrl", label: "Attachment", type: "file", folder: "invoices", preview: true },
        { name: "notes", label: "Notes" },
      ]}
    />
    </div>
  );
}
