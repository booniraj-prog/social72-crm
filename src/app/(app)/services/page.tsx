import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/session";
import { hasPermission } from "@/lib/rbac";
import { listClients } from "@/modules/clients/service";
import { listServiceBoard } from "@/modules/platform/service";
import { CAPTURE_CHANNELS, PRIORITIES, SERVICE_LINES } from "@/modules/platform/constants";
import { SimpleBoard } from "@/components/platform/simple-board";
import { SectionNewClient } from "@/components/clients/section-new-client";

export default async function ServicesPage() {
  const actor = await getAuthUser();
  if (!actor) redirect("/login");
  const [rows, clients] = await Promise.all([listServiceBoard(actor), listClients("services")]);
  return (
    <div>
      <div className="mb-4 flex justify-end">
        {hasPermission(actor, "client.write") ? <SectionNewClient industryKey="services" label="New service client" /> : null}
      </div>
      <SimpleBoard
        eyebrow="Delivery"
        title="Service pipelines"
        summary="Website, software, ads and branding enquiries. Won jobs become Projects. Calling and follow-ups are unchanged."
        kind="service-lead"
        canCreate={Boolean(clients[0])}
        columns={["name", "client", "serviceLine", "status", "owner"]}
        rows={rows}
        fields={[
          { name: "name", label: "Contact name", required: true },
          { name: "mobile", label: "Mobile", required: true },
          {
            name: "clientId",
            label: "Client",
            required: true,
            options: clients.map((c) => ({ value: c.id, label: c.name })),
          },
          {
            name: "serviceLine",
            label: "Service line",
            options: SERVICE_LINES.map((s) => ({ value: s, label: s })),
          },
          {
            name: "captureChannel",
            label: "Channel",
            options: CAPTURE_CHANNELS.map((s) => ({ value: s, label: s })),
          },
          {
            name: "priority",
            label: "Priority",
            options: PRIORITIES.map((s) => ({ value: s, label: s })),
          },
        ]}
      />
    </div>
  );
}
