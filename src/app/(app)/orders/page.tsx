import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/session";
import { listClients } from "@/modules/clients/service";
import { listDocuments, listEngagements, listInvoices } from "@/modules/platform/service";
import { listClientOrders } from "@/modules/resources/service";
import { formatInr } from "@/lib/money";
import { SimpleBoard } from "@/components/platform/simple-board";
import { AttachmentsPanel } from "@/components/platform/attachments-panel";
import { canDeleteRecords } from "@/lib/rbac";

export default async function ClientOrdersPage() {
  const actor = await getAuthUser();
  if (!actor) redirect("/login");
  const [orders, clients, projects, invoices, files] = await Promise.all([
    listClientOrders(),
    listClients(),
    listEngagements(),
    listInvoices(),
    listDocuments(),
  ]);
  return (
    <div>
    <SimpleBoard
      eyebrow="Finance"
      title="Client POs"
      summary="Track inbound client purchase orders against a client and project. Follow up billed vs PO; benchmark is the agreed price for invoices."
      kind="client-order"
      columns={["number", "client", "project", "payment", "followUp", "value", "billed", "bench", "remaining"]}
      rows={orders.map((o) => {
        return {
          id: o.id,
          number: o.number,
          client: o.client ?? "—",
          project: o.project ?? "—",
          payment: o.payment,
          followUp: o.followUp,
          value: `₹${formatInr(o.value)}`,
          billed: `₹${formatInr(o.billed)}`,
          bench: o.bench ? `₹${formatInr(o.bench)} (${o.vsBench})` : "—",
          remaining: `₹${formatInr(o.remaining)}`,
        };
      })}
      fields={[
        { name: "clientId", label: "Client", required: true, options: clients.map((c) => ({ value: c.id, label: c.name })) },
        { name: "engagementId", label: "Project", options: projects.map((p) => ({ value: p.id, label: `${p.name} · ${p.client.name}` })) },
        { name: "number", label: "PO number", required: true },
        { name: "value", label: "PO value", type: "number", required: true },
        { name: "benchmarkAmount", label: "Benchmark price", type: "number" },
        { name: "orderedAt", label: "PO date", type: "date" },
        { name: "validUntil", label: "Valid until", type: "date" },
        { name: "followUpAt", label: "Payment follow-up", type: "date" },
        { name: "documentUrl", label: "PO document", type: "file", folder: "orders", preview: true },
        { name: "notes", label: "Notes" },
      ]}
    />
      <AttachmentsPanel
        compact
        title="PO attachments"
        canDelete={canDeleteRecords(actor)}
        files={files.filter((f) => f.clientOrderId)}
        clients={clients.map((c) => ({ value: c.id, label: c.name }))}
        projects={projects.map((p) => ({ value: p.id, label: `${p.name} · ${p.client.name}` }))}
        invoices={invoices.filter((i) => i.kind !== "QUOTE").map((i) => ({ value: i.id, label: `${i.number} · ${i.client.name}` }))}
        orders={orders.map((o) => ({ value: o.id, label: `${o.number} · ${o.client ?? "PO"}` }))}
      />
    </div>
  );
}
