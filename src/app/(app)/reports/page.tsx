import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/rbac";
import { getAuthUser } from "@/lib/session";
import { listClients } from "@/modules/clients/service";
import { listCampaigns } from "@/modules/campaigns/service";
import { insightKpis } from "@/modules/insights/service";
import { REPORT_TYPES, buildReport, type ReportKey } from "@/modules/reports/service";
import { ReportsBoard } from "./reports-board";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; from?: string; to?: string; clientId?: string; campaignId?: string }>;
}) {
  const actor = await getAuthUser();
  if (!actor || !hasPermission(actor, "report.read")) redirect("/dashboard");
  const params = await searchParams;
  const type = (REPORT_TYPES.some((t) => t.key === params.type) ? params.type : "leads") as ReportKey;
  const filters = {
    from: params.from || undefined,
    to: params.to || undefined,
    clientId: params.clientId || undefined,
    campaignId: params.campaignId || undefined,
  };

  const [kpis, rows, clients, campaigns] = await Promise.all([
    insightKpis(actor, filters),
    buildReport(actor, type, filters),
    hasPermission(actor, "client.read") ? listClients() : Promise.resolve([]),
    hasPermission(actor, "campaign.read") ? listCampaigns(filters.clientId) : Promise.resolve([]),
  ]);

  return (
    <ReportsBoard
      type={type}
      types={[...REPORT_TYPES]}
      snapshot={{
        leads: kpis.leads,
        won: kpis.won,
        conversionRate: kpis.conversionRate,
        revenue: kpis.revenue,
        spend: kpis.spend,
        cpl: kpis.cpl,
      }}
      rows={rows as Array<Record<string, unknown>>}
      canExport={hasPermission(actor, "report.export")}
      filters={{
        from: params.from ?? "",
        to: params.to ?? "",
        clientId: params.clientId ?? "",
        campaignId: params.campaignId ?? "",
      }}
      clients={clients.map((c) => ({ id: c.id, name: c.name }))}
      campaigns={campaigns.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
