import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/rbac";
import { canCreateLeads } from "@/lib/scope";
import { getAuthUser } from "@/lib/session";
import { listClients } from "@/modules/clients/service";
import { listCampaigns } from "@/modules/campaigns/service";
import { listAssignees, listLeadSources, listLeadStatuses, listLeads } from "@/modules/leads/service";
import { listDocuments } from "@/modules/platform/service";
import { LeadsBoard } from "./leads-board";
import type { LeadRow } from "@/modules/leads/types";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getAuthUser();
  if (!actor || !hasPermission(actor, "lead.read")) redirect("/dashboard");

  const raw = await searchParams;
  const filters: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string" && value) filters[key] = value;
  }

  const [result, statuses, sources, assignees, clients, campaigns, files] = await Promise.all([
    listLeads(actor, filters),
    listLeadStatuses(),
    listLeadSources(),
    listAssignees(),
    hasPermission(actor, "client.read") ? listClients() : Promise.resolve([]),
    listCampaigns(),
    listDocuments(),
  ]);

  return (
    <LeadsBoard
      leads={result.leads as unknown as LeadRow[]}
      total={result.total}
      page={result.page}
      pageSize={result.pageSize}
      filters={filters}
      canCreate={canCreateLeads(actor)}
      canImport={hasPermission(actor, "lead.write")}
      canWrite={hasPermission(actor, "lead.write")}
      canCreateCampaign={hasPermission(actor, "campaign.write")}
      importOpen={filters.import === "1"}
      importFiles={files
        .filter((f) => f.kind === "LEAD_IMPORT")
        .map((f) => ({
          id: f.id,
          filename: f.filename,
          url: f.url,
          createdAt: f.createdAt,
          client: f.client,
          clientId: f.clientId,
        }))}
      clients={clients.map((c) => ({
        id: c.id,
        name: c.name,
        industry: c.industry ? { id: c.industry.id, name: c.industry.name } : null,
      }))}
      campaigns={campaigns.map((c) => ({ id: c.id, name: c.name, clientId: c.clientId }))}
      assignees={assignees.map((a) => ({ id: a.id, name: a.name }))}
      currentUserId={actor.id}
      options={{
        statuses,
        sources,
        assignees,
        temperatures: ["HOT", "WARM", "COLD", "UNQUALIFIED"],
      }}
    />
  );
}
