import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AuthUser } from "@/lib/rbac";
import { pct, round2, safeDiv } from "@/lib/money";
import { leadScopeWhere } from "@/lib/scope";
import { istRange, ymdInIst } from "@/lib/time";
import { INVALID_STATUS_KEYS, QUALIFIED_STATUS_KEYS, WON_STATUS_KEYS } from "@/modules/insights/constants";
import { metricsFromCounts } from "@/modules/insights/metrics";

export { metricsFromCounts } from "@/modules/insights/metrics";

export type InsightFilters = {
  from?: string;
  to?: string;
  clientId?: string;
  campaignId?: string;
  industryId?: string;
  sourceId?: string;
  assignedUserId?: string;
};

function dayStart(value?: string) {
  if (!value) return undefined;
  return new Date(`${value}T00:00:00+05:30`);
}

function dayEnd(value?: string) {
  if (!value) return undefined;
  return new Date(`${value}T23:59:59.999+05:30`);
}

export async function insightLeadWhere(
  actor: AuthUser,
  filters: InsightFilters,
): Promise<Prisma.LeadWhereInput> {
  const scope = await leadScopeWhere(actor);
  const and: Prisma.LeadWhereInput[] = [scope];
  const gte = dayStart(filters.from);
  const lte = dayEnd(filters.to);
  if (gte || lte) {
    and.push({
      OR: [
        { generatedAt: { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) } },
        { generatedAt: null, createdAt: { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) } },
      ],
    });
  }
  if (filters.clientId) and.push({ clientId: filters.clientId });
  if (filters.campaignId) and.push({ campaignId: filters.campaignId });
  if (filters.industryId) and.push({ industryId: filters.industryId });
  if (filters.sourceId) and.push({ sourceId: filters.sourceId });
  if (filters.assignedUserId === "unassigned") and.push({ assignedUserId: null });
  else if (filters.assignedUserId) and.push({ assignedUserId: filters.assignedUserId });
  return { AND: and };
}

export async function computeLeadMetrics(where: Prisma.LeadWhereInput) {
  const [
    leads,
    valid,
    qualified,
    hot,
    contacted,
    connected,
    campusVisits,
    siteVisits,
    won,
    lost,
    revenueAgg,
    expectedAgg,
    newCount,
    assigned,
  ] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.count({ where: { AND: [where, { status: { key: { notIn: [...INVALID_STATUS_KEYS] } } }] } }),
    prisma.lead.count({
      where: { AND: [where, { status: { key: { in: [...QUALIFIED_STATUS_KEYS] } } }] },
    }),
    prisma.lead.count({ where: { AND: [where, { temperature: "HOT" }] } }),
    prisma.lead.count({ where: { AND: [where, { lastContactAt: { not: null } }] } }),
    prisma.lead.count({
      where: { AND: [where, { status: { key: { in: ["CONNECTED", ...QUALIFIED_STATUS_KEYS, ...WON_STATUS_KEYS] } } }] },
    }),
    prisma.campusVisit.count({ where: { lead: where } }),
    prisma.siteVisit.count({ where: { lead: where } }),
    prisma.lead.count({ where: { AND: [where, { status: { key: { in: [...WON_STATUS_KEYS] } } }] } }),
    prisma.lead.count({ where: { AND: [where, { status: { key: "CLOSED_LOST" } }] } }),
    prisma.lead.aggregate({
      where: { AND: [where, { status: { key: { in: [...WON_STATUS_KEYS] } } }] },
      _sum: { actualRevenue: true },
    }),
    prisma.lead.aggregate({ where, _sum: { expectedRevenue: true } }),
    prisma.lead.count({ where: { AND: [where, { status: { key: "NEW" } }] } }),
    prisma.lead.count({ where: { AND: [where, { assignedUserId: { not: null } }] } }),
  ]);

  return {
    leads,
    valid,
    qualified,
    hot,
    contacted,
    connected,
    visits: campusVisits + siteVisits,
    campusVisits,
    siteVisits,
    won,
    lost,
    newCount,
    assigned,
    revenue: Number(revenueAgg._sum.actualRevenue ?? 0),
    expectedRevenue: Number(expectedAgg._sum.expectedRevenue ?? 0),
  };
}

export async function spendForWhere(where: Prisma.LeadWhereInput) {
  const campaigns = await prisma.lead.findMany({
    where,
    distinct: ["campaignId"],
    select: { campaignId: true },
  });
  const ids = campaigns.map((c) => c.campaignId);
  if (ids.length === 0) return 0;
  const [lineSum, campaignSum] = await Promise.all([
    prisma.marketingSpend.aggregate({
      where: { campaignId: { in: ids } },
      _sum: { amount: true },
    }),
    prisma.campaign.aggregate({
      where: { id: { in: ids } },
      _sum: { actualSpend: true },
    }),
  ]);
  const lines = Number(lineSum._sum.amount ?? 0);
  return lines > 0 ? lines : Number(campaignSum._sum.actualSpend ?? 0);
}

export async function insightKpis(actor: AuthUser, filters: InsightFilters) {
  const where = await insightLeadWhere(actor, filters);
  const base = await computeLeadMetrics(where);
  const spend = await spendForWhere(where);
  return metricsFromCounts({ ...base, spend });
}

export async function funnelSeries(actor: AuthUser, filters: InsightFilters) {
  const where = await insightLeadWhere(actor, filters);
  const steps = [
    { key: "leads", label: "Leads", status: null as string[] | null },
    { key: "contacted", label: "Contacted", status: ["CALL_ATTEMPTED", "CONNECTED"] },
    { key: "connected", label: "Connected", status: ["CONNECTED"] },
    { key: "qualified", label: "Qualified", status: ["QUALIFIED"] },
    { key: "interested", label: "Interested", status: ["INTERESTED"] },
    { key: "visit", label: "Visit", status: ["CAMPUS_VISIT", "SITE_VISIT", "SITE_VISIT_COMPLETED"] },
    { key: "negotiate", label: "Negotiate", status: ["NEGOTIATION", "COUNSELLING", "BOOKING"] },
    { key: "won", label: "Closed won", status: ["CLOSED_WON"] },
  ];
  const total = await prisma.lead.count({ where });
  const counts = await Promise.all(
    steps.map(async (step) => {
      if (!step.status) return total;
      if (step.key === "contacted") {
        return prisma.lead.count({ where: { AND: [where, { lastContactAt: { not: null } }] } });
      }
      return prisma.lead.count({ where: { AND: [where, { status: { key: { in: step.status } } }] } });
    }),
  );
  return steps.map((step, i) => ({
    key: step.key,
    label: step.label,
    count: counts[i],
    pct: pct(counts[i], total),
    drop: i === 0 ? 0 : pct(Math.max(0, counts[i - 1] - counts[i]), counts[i - 1] || 1),
  }));
}

export async function generationTrend(actor: AuthUser, filters: InsightFilters, days = 14) {
  const where = await insightLeadWhere(actor, filters);
  const since = new Date();
  since.setDate(since.getDate() - days);
  const rows = await prisma.lead.findMany({
    where: { AND: [where, { createdAt: { gte: since } }] },
    select: { createdAt: true, generatedAt: true },
  });
  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    buckets.set(ymdInIst(d), 0);
  }
  for (const row of rows) {
    const key = ymdInIst(row.generatedAt ?? row.createdAt);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([date, count]) => ({ date, count }));
}

export async function sourceBreakdown(actor: AuthUser, filters: InsightFilters) {
  const where = await insightLeadWhere(actor, filters);
  const groups = await prisma.lead.groupBy({
    by: ["sourceId"],
    where,
    _count: { _all: true },
    _sum: { actualRevenue: true },
  });
  const sources = await prisma.leadSource.findMany();
  const byId = Object.fromEntries(sources.map((s) => [s.id, s.name]));
  return groups
    .map((g) => ({
      name: g.sourceId ? byId[g.sourceId] ?? "Unknown" : "Unspecified",
      leads: g._count._all,
      revenue: Number(g._sum.actualRevenue ?? 0),
    }))
    .sort((a, b) => b.leads - a.leads);
}

export async function opsSnapshot(actor: AuthUser, filters: InsightFilters) {
  const where = await insightLeadWhere(actor, filters);
  const today = istRange("today");
  const overdue = istRange("overdue");
  const [followupsToday, overdueFollowups, slaAssign, slaCall] = await Promise.all([
    prisma.lead.count({
      where: { AND: [where, { status: { isFinal: false }, nextFollowupAt: { gte: today.gte, lt: today.lt } }] },
    }),
    prisma.lead.count({
      where: { AND: [where, { status: { isFinal: false }, nextFollowupAt: { lt: overdue.lt } }] },
    }),
    prisma.lead.count({
      where: { AND: [where, { slaAssignBreached: true, status: { isFinal: false } }] },
    }),
    prisma.lead.count({
      where: { AND: [where, { slaFirstCallBreached: true, status: { isFinal: false } }] },
    }),
  ]);
  return { followupsToday, overdueFollowups, slaAssign, slaCall };
}

export async function campaignBreakdown(actor: AuthUser, filters: InsightFilters) {
  const where = await insightLeadWhere(actor, filters);
  const groups = await prisma.lead.groupBy({
    by: ["campaignId"],
    where,
    _count: { _all: true },
    _sum: { actualRevenue: true },
  });
  const ids = groups.map((g) => g.campaignId);
  if (ids.length === 0) return [];
  const [campaigns, spendLines] = await Promise.all([
    prisma.campaign.findMany({
      where: { id: { in: ids } },
      include: { client: { select: { name: true } } },
    }),
    prisma.marketingSpend.groupBy({
      by: ["campaignId"],
      where: { campaignId: { in: ids } },
      _sum: { amount: true },
    }),
  ]);
  const byId = Object.fromEntries(campaigns.map((c) => [c.id, c]));
  const spendById = Object.fromEntries(
    spendLines.map((s) => [s.campaignId, Number(s._sum.amount ?? 0)]),
  );
  return groups
    .map((g) => {
      const campaign = byId[g.campaignId];
      const spend = spendById[g.campaignId] || Number(campaign?.actualSpend ?? 0);
      const leads = g._count._all;
      const revenue = Number(g._sum.actualRevenue ?? 0);
      return {
        id: g.campaignId,
        name: campaign?.name ?? "Unknown",
        client: campaign?.client.name ?? "—",
        leads,
        spend,
        revenue,
        cpl: round2(safeDiv(spend, leads)),
        roi: round2(safeDiv(revenue - spend, spend) * 100),
      };
    })
    .sort((a, b) => b.leads - a.leads);
}

export async function callTrend(actor: AuthUser, filters: InsightFilters, days = 14) {
  const where = await insightLeadWhere(actor, filters);
  const since = new Date();
  since.setDate(since.getDate() - days);
  const rows = await prisma.callLog.findMany({
    where: { startedAt: { gte: since }, lead: where },
    select: { startedAt: true, disposition: { select: { key: true } } },
  });
  const buckets = new Map<string, { calls: number; connected: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    buckets.set(ymdInIst(d), { calls: 0, connected: 0 });
  }
  const connectedKeys = new Set([
    "CONNECTED",
    "INTERESTED",
    "NOT_INTERESTED",
    "CALL_BACK",
    "FOLLOW_UP_REQUIRED",
    "SITE_VISIT_AGREED",
    "CAMPUS_VISIT_AGREED",
    "CLOSED_WON",
  ]);
  for (const row of rows) {
    const key = ymdInIst(row.startedAt);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.calls += 1;
    if (row.disposition?.key && connectedKeys.has(row.disposition.key)) bucket.connected += 1;
  }
  return [...buckets.entries()].map(([date, value]) => ({ date, ...value }));
}

export async function statusBreakdown(actor: AuthUser, filters: InsightFilters) {
  const where = await insightLeadWhere(actor, filters);
  const groups = await prisma.lead.groupBy({
    by: ["statusId"],
    where,
    _count: { _all: true },
  });
  const statuses = await prisma.leadStatus.findMany();
  const byId = Object.fromEntries(statuses.map((s) => [s.id, s]));
  return groups
    .map((g) => ({
      key: byId[g.statusId]?.key ?? g.statusId,
      name: byId[g.statusId]?.name ?? "Unknown",
      color: byId[g.statusId]?.color ?? "#64748b",
      count: g._count._all,
    }))
    .sort((a, b) => b.count - a.count);
}
