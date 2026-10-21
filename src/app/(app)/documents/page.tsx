import { redirect } from "next/navigation";
import { canDeleteRecords } from "@/lib/rbac";
import { getAuthUser } from "@/lib/session";
import { listClients } from "@/modules/clients/service";
import { listDocuments, listEngagements, listInvoices, listPeople } from "@/modules/platform/service";
import { listClientOrders } from "@/modules/resources/service";
import { AttachmentsPanel } from "@/components/platform/attachments-panel";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; engagementId?: string; invoiceId?: string; clientOrderId?: string }>;
}) {
  const actor = await getAuthUser();
  if (!actor) redirect("/login");
  const params = await searchParams;
  const filter = {
    clientId: params.clientId || undefined,
    engagementId: params.engagementId || undefined,
    invoiceId: params.invoiceId || undefined,
    clientOrderId: params.clientOrderId || undefined,
  };
  const [files, clients, projects, invoices, orders, people] = await Promise.all([
    listDocuments(filter),
    listClients(),
    listEngagements(),
    listInvoices(),
    listClientOrders(),
    listPeople(),
  ]);
  return (
    <AttachmentsPanel
      title="Documents"
      canDelete={canDeleteRecords(actor)}
      defaults={filter}
      files={files}
      clients={clients.map((c) => ({ value: c.id, label: c.name }))}
      projects={projects.map((p) => ({ value: p.id, label: `${p.name} · ${p.client.name}` }))}
      invoices={invoices
        .filter((i) => i.kind !== "QUOTE")
        .map((i) => ({ value: i.id, label: `${i.number} · ${i.client.name}` }))}
      orders={orders.map((o) => ({ value: o.id, label: `${o.number} · ${o.client ?? "PO"}` }))}
      people={people.map((p) => ({ value: p.id, label: p.name }))}
    />
  );
}
