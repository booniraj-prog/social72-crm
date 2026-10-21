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
import { paymentStatus, vsBench } from "@/lib/commercial";

export const REPORT_TYPES = [
  { key: "leads", label: "Leads" },
  { key: "followups", label: "Follow-ups" },
  { key: "campaigns", label: "Campaigns" },
  { key: "source", label: "Sources" },
  { key: "bpo", label: "Calling floor" },
  { key: "client", label: "Clients" },
  { key: "collections", label: "Collections" },
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

  if (type === "campaigns") {
    return campaignBreakdown(actor, filters);
  }

  if (type === "bpo") {
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

  if (type === "collections") {
    const invoices = await prisma.invoice.findMany({
      where: { kind: { not: "QUOTE" }, status: { not: "VOID" } },
      take: 500,
      orderBy: { createdAt: "desc" },
      include: { client: { select: { name: true } }, engagement: { select: { name: true, budget: true } } },
    });
    const extras = await prisma
      .$queryRaw<
        Array<{ id: string; follow_up_at: Date | null; benchmark_amount: unknown; po_value: unknown }>
      >`
        SELECT i.id, i.follow_up_at, i.benchmark_amount, e.po_value
        FROM invoices i
        LEFT JOIN engagements e ON e.id = i.engagement_id
      `
      .catch(() => [] as Array<{ id: string; follow_up_at: Date | null; benchmark_amount: unknown; po_value: unknown }>);
    const extraById = Object.fromEntries(extras.map((row) => [row.id, row]));
    return invoices.map((i) => {
      const total = Number(i.total ?? 0);
      const paid = Number(i.paid ?? 0);
      const extra = extraById[i.id];
      const bench = Number(extra?.benchmark_amount ?? 0) || Number(extra?.po_value ?? 0) || Number(i.engagement?.budget ?? 0);
      return {
        invoice: i.number,
        client: i.client.name,
        project: i.engagement?.name ?? "—",
        payment: paymentStatus({ total, paid, dueDate: i.dueDate, status: i.status }),
        billed: total,
        collected: paid,
        outstanding: total - paid,
        bench,
        vsBench: vsBench(total, bench),
        followUp: extra?.follow_up_at ? new Date(extra.follow_up_at).toISOString().slice(0, 10) : "",
        due: i.dueDate?.toISOString().slice(0, 10) ?? "",
      };
    });
  }

  return [];
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
