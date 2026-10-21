import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/session";
import { listDocuments, listEngagements, listInvoices, listPeople } from "@/modules/platform/service";
import { listCapacity, listClientOrders } from "@/modules/resources/service";
import { listClients } from "@/modules/clients/service";
import { canDeleteRecords } from "@/lib/rbac";
import { AttachmentsPanel } from "@/components/platform/attachments-panel";
import { ResourceBoard } from "./resource-board";

export default async function ResourcesPage() {
  const actor = await getAuthUser();
  if (!actor) redirect("/login");
  const [people, projects, files, clients, invoices, orders, roster] = await Promise.all([
    listCapacity(),
    listEngagements(),
    listDocuments(),
    listClients(),
    listInvoices(),
    listClientOrders(),
    listPeople(),
  ]);
  return (
    <div>
      <ResourceBoard
        people={people}
        projects={projects.map((p) => ({ id: p.id, name: `${p.name} · ${p.client.name}` }))}
      />
      <AttachmentsPanel
        compact
        title="Resource files"
        canDelete={canDeleteRecords(actor)}
        files={files.filter((f) => f.userId)}
        clients={clients.map((c) => ({ value: c.id, label: c.name }))}
        projects={projects.map((p) => ({ value: p.id, label: `${p.name} · ${p.client.name}` }))}
        invoices={invoices.filter((i) => i.kind !== "QUOTE").map((i) => ({ value: i.id, label: `${i.number} · ${i.client.name}` }))}
        orders={orders.map((o) => ({ value: o.id, label: `${o.number} · ${o.client ?? "PO"}` }))}
        people={roster.map((p) => ({ value: p.id, label: p.name }))}
      />
    </div>
  );
}
