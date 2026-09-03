import type { AuthUser } from "@/lib/rbac";
import { toCsv } from "@/lib/csv";
import { formatInr } from "@/lib/money";
import { listCallerPerformance } from "@/modules/bpo/service";
import {
  type InsightFilters,
  campaignBreakdown,
  computeLeadMetrics,
  insightKpis,
  insightLeadWhere,
  sourceBreakdown,
  spendForWhere,
} from "@/modules/insights/service";
import { prisma } from "@/lib/db";

export const REPORT_TYPES = [
  { key: "leads", label: "Lead" },
  { key: "campaigns", label: "Campaign" },
  { key: "bpo", label: "BPO performance" },
  { key: "followups", label: "Follow-up" },
  { key: "conversion", label: "Conversion" },
  { key: "revenue", label: "Revenue" },
  { key: "roi", label: "ROI" },
  { key: "source", label: "Source performance" },
  { key: "executive", label: "Executive" },
  { key: "client", label: "Client" },
  { key: "education", label: "Education admission" },
  { key: "real_estate", label: "Real estate registration" },
] as const;

export type ReportKey = (typeof REPORT_TYPES)[number]["key"];

export async function buildReport(actor: AuthUser, type: ReportKey, filters: InsightFilters) {
  const where = await insightLeadWhere(actor, filters);

  if (type === "leads") {
    const leads = await prisma.lead.findMany({
      where,
      take: 2000,
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { name: true } },
        campaign: { select: { name: true } },
        status: { select: { name: true, key: true } },
        assignedUser: { select: { name: true } },
        source: { select: { name: true } },
      },
    });
    return leads.map((lead) => ({
      leadNumber: lead.leadNumber,
      name: lead.fullName,
      mobile: lead.mobileE164,
      client: lead.client.name,
      campaign: lead.campaign.name,
      status: lead.status.name,
      temperature: lead.temperature,
      source: lead.source?.name ?? "",
      owner: lead.assignedUser?.name ?? "",
      expectedRevenue: Number(lead.expectedRevenue ?? 0),
      actualRevenue: Number(lead.actualRevenue ?? 0),
    }));
  }

  if (type === "campaigns" || type === "roi") {
    return campaignBreakdown(actor, filters);
  }

  if (type === "bpo" || type === "executive") {
    return listCallerPerformance(actor);
  }

  if (type === "followups") {
    const leads = await prisma.lead.findMany({
      where: { AND: [where, { status: { isFinal: false } }] },
      take: 2000,
      orderBy: { nextFollowupAt: "asc" },
      include: {
        assignedUser: { select: { name: true } },
        status: { select: { name: true } },
      },
    });
    return leads.map((lead) => ({
      leadNumber: lead.leadNumber,
      name: lead.fullName,
      status: lead.status.name,
      owner: lead.assignedUser?.name ?? "",
      nextFollowup: lead.nextFollowupAt?.toISOString() ?? "",
      nextAction: lead.nextAction ?? "",
      overdue: lead.nextFollowupAt && lead.nextFollowupAt < new Date() ? "yes" : "no",
    }));
  }

  if (type === "conversion") {
    const kpis = await insightKpis(actor, filters);
    return [
      {
        leads: kpis.leads,
        contacted: kpis.contacted,
        connected: kpis.connected,
        qualified: kpis.qualified,
        visits: kpis.visits,
        won: kpis.won,
        lost: kpis.lost,
        conversionRate: kpis.conversionRate,
      },
    ];
  }

  if (type === "revenue") {
    const won = await prisma.lead.findMany({
      where: { AND: [where, { status: { key: { in: ["CLOSED_WON", "ADMISSION_CONFIRMED", "REGISTRATION"] } } }] },
      take: 2000,
      include: { client: { select: { name: true } }, campaign: { select: { name: true } } },
    });
    return won.map((lead) => ({
      leadNumber: lead.leadNumber,
      name: lead.fullName,
      client: lead.client.name,
      campaign: lead.campaign.name,
      actualRevenue: Number(lead.actualRevenue ?? 0),
      closedAt: lead.closureDate?.toISOString() ?? "",
    }));
  }

  if (type === "source") {
    return sourceBreakdown(actor, filters);
  }

  if (type === "client") {
    const groups = await prisma.lead.groupBy({
      by: ["clientId"],
      where,
      _count: { _all: true },
      _sum: { actualRevenue: true },
    });
    const clients = await prisma.client.findMany({ where: { id: { in: groups.map((g) => g.clientId) } } });
    const byId = Object.fromEntries(clients.map((c) => [c.id, c.name]));
    return Promise.all(
      groups.map(async (g) => {
        const clientWhere = { AND: [where, { clientId: g.clientId }] };
        const metrics = await computeLeadMetrics(clientWhere);
        const spend = await spendForWhere(clientWhere);
        return {
          client: byId[g.clientId] ?? g.clientId,
          leads: metrics.leads,
          qualified: metrics.qualified,
          visits: metrics.visits,
          won: metrics.won,
          spend,
          revenue: metrics.revenue,
          cpl: metrics.leads ? Math.round((spend / metrics.leads) * 100) / 100 : 0,
        };
      }),
    );
  }

  if (type === "education") {
    const leads = await prisma.lead.findMany({
      where: { AND: [where, { industry: { key: "education" } }] },
      take: 2000,
      include: {
        education: true,
        client: { select: { name: true } },
        status: { select: { name: true } },
      },
    });
    return leads.map((lead) => ({
      leadNumber: lead.leadNumber,
      student: lead.education?.studentName ?? lead.fullName,
      parent: lead.education?.parentName ?? "",
      campus: lead.education?.preferredCampus ?? "",
      status: lead.status.name,
      admission: lead.education?.admissionStatus ?? "",
      client: lead.client.name,
      fee: Number(lead.education?.fee ?? 0),
    }));
  }

  const leads = await prisma.lead.findMany({
    where: { AND: [where, { industry: { key: "real_estate" } }] },
    take: 2000,
    include: {
      realEstate: true,
      client: { select: { name: true } },
      status: { select: { name: true } },
    },
  });
  return leads.map((lead) => ({
    leadNumber: lead.leadNumber,
    name: lead.fullName,
    project: lead.realEstate?.preferredLocation ?? "",
    status: lead.status.name,
    bookingAmount: Number(lead.realEstate?.bookingAmount ?? 0),
    propertyValue: Number(lead.realEstate?.propertyValue ?? 0),
    client: lead.client.name,
  }));
}

export async function reportCsv(actor: AuthUser, type: ReportKey, filters: InsightFilters) {
  const rows = await buildReport(actor, type, filters);
  const flat = (Array.isArray(rows) ? rows : []).map((row) => {
    const out: Record<string, string | number | null | undefined> = {};
    for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
      if (typeof value === "number") out[key] = value;
      else if (value == null) out[key] = "";
      else out[key] = String(value);
    }
    return out;
  });
  return toCsv(flat);
}

export function reportSummaryLine(kpis: Awaited<ReturnType<typeof insightKpis>>) {
  return `Leads ${kpis.leads} · Spend ₹${formatInr(kpis.spend)} · Revenue ₹${formatInr(kpis.revenue)} · CPL ₹${formatInr(kpis.cpl)} · Conv ${kpis.conversionRate}% · ROI ${kpis.roi}%`;
}
