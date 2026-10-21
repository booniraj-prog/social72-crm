import { getAuthUser } from "@/lib/session";
import { listClients } from "@/modules/clients/service";
import { hasPermission } from "@/lib/rbac";
import { listCampaigns } from "@/modules/campaigns/service";
import {
  callTrend,
  campaignBreakdown,
  funnelSeries,
  generationTrend,
  insightKpis,
  opsSnapshot,
  sourceBreakdown,
} from "@/modules/insights/service";
import { runOpsTick } from "@/modules/ops/service";
import { prisma } from "@/lib/db";
import { listCallerPerformance } from "@/modules/bpo/service";
import { platformKpis } from "@/modules/platform/service";
import { isHiddenIndustry } from "@/lib/industries";
import { DashboardBoard } from "./dashboard-board";
import { DASHBOARD_PERIODS, istPeriodRange, type DashboardPeriod } from "@/lib/time";
import { listAssignees } from "@/modules/leads/service";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    clientId?: string;
    campaignId?: string;
    industryId?: string;
    sourceId?: string;
    assignedUserId?: string;
    period?: string;
  }>;
}) {
  const actor = await getAuthUser();
  if (!actor) return null;
  const params = await searchParams;
  const period = DASHBOARD_PERIODS.includes(params.period as DashboardPeriod)
    ? (params.period as DashboardPeriod)
    : "month";
  const range = period ? istPeriodRange(period) : null;
  const filters = {
    from: params.from || range?.from || undefined,
    to: params.to || range?.to || undefined,
    clientId: params.clientId || undefined,
    campaignId: params.campaignId || undefined,
    industryId: params.industryId || undefined,
    sourceId: params.sourceId || undefined,
    assignedUserId: params.assignedUserId || undefined,
  };

  await runOpsTick(actor).catch(() => undefined);

  const [kpis, ops, funnel, trend, calls, sources, campaigns, executives, clients, allCampaigns, industries, leadSources, platform, people] =
    await Promise.all([
      insightKpis(actor, filters),
      opsSnapshot(actor, filters),
      funnelSeries(actor, filters),
      generationTrend(actor, filters),
      callTrend(actor, filters),
      sourceBreakdown(actor, filters),
      campaignBreakdown(actor, filters),
      listCallerPerformance(actor),
      hasPermission(actor, "client.read") ? listClients() : Promise.resolve([]),
      hasPermission(actor, "campaign.read") ? listCampaigns(filters.clientId) : Promise.resolve([]),
      prisma.industry.findMany({ orderBy: { name: "asc" } }),
      prisma.leadSource.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      platformKpis(),
      listAssignees(),
    ]);

  return (
    <DashboardBoard
      kpis={{
        ...kpis,
        newCount: kpis.newCount ?? 0,
        assigned: kpis.assigned ?? 0,
      }}
      ops={ops}
      funnel={funnel}
      trend={trend}
      calls={calls}
      sources={sources}
      campaigns={campaigns}
      executives={executives.slice(0, 8)}
      filters={{
        from: params.from ?? "",
        to: params.to ?? "",
        clientId: params.clientId ?? "",
        campaignId: params.campaignId ?? "",
        industryId: params.industryId ?? "",
        sourceId: params.sourceId ?? "",
        assignedUserId: params.assignedUserId ?? "",
      }}
      clients={clients.map((c) => ({ id: c.id, name: c.name }))}
      campaignOptions={allCampaigns.map((c) => ({ id: c.id, name: c.name }))}
      industries={industries.filter((i) => !isHiddenIndustry(i.key)).map((i) => ({ id: i.id, name: i.name }))}
      sourcesOptions={leadSources.map((s) => ({ id: s.id, name: s.name }))}
      platform={platform}
      people={people.map((p) => ({ id: p.id, name: p.name }))}
      period={period}
    />
  );
}
