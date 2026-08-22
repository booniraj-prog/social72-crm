import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/rbac";
import { getAuthUser } from "@/lib/session";
import { listClients, listIndustries } from "@/modules/clients/service";
import { ClientsManager } from "./clients-manager";

export default async function ClientsPage() {
  const actor = await getAuthUser();
  if (!actor || !hasPermission(actor, "client.read")) redirect("/dashboard");

  const [clients, industries] = await Promise.all([listClients(), listIndustries()]);

  return (
    <ClientsManager
      canWrite={hasPermission(actor, "client.write")}
      industries={industries.map((i) => ({ id: i.id, name: i.name }))}
      clients={clients.map((c) => ({
        id: c.id,
        name: c.name,
        contactName: c.contactName,
        contactEmail: c.contactEmail,
        contactPhone: c.contactPhone,
        isActive: c.isActive,
        industry: c.industry ? { id: c.industry.id, name: c.industry.name } : null,
        _count: c._count,
      }))}
    />
  );
}
