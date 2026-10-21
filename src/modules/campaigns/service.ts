import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { HttpError } from "@/lib/session";
import type { AuthUser } from "@/lib/rbac";
import { fromIstDateInput } from "@/lib/time";
import { normalizeMobile } from "@/lib/phone";
import { createLeadWithDuplicateInfo } from "@/modules/leads/service";
import { computeLeadMetrics, metricsFromCounts } from "@/modules/insights/service";
import { CAMPAIGN_TYPES, PLATFORMS } from "@/modules/insights/constants";
import { requiredId } from "@/lib/ids";

function campaignScope(actor: AuthUser) {
  if (actor.roleKey === "marketing_manager") {
    return {
      OR: [{ ownerUserId: actor.id }, { managers: { some: { userId: actor.id } } }],
    };
  }
  return {};
}

export const createCampaignSchema = z.object({
  name: z.string().trim().min(2).max(160),
  clientId: requiredId("a client"),
  platform: z.string().trim().max(40).optional().or(z.literal("")),
  campaignType: z.string().trim().max(40).optional().or(z.literal("")),
  startDate: z.string().optional().or(z.literal("")),
  endDate: z.string().optional().or(z.literal("")),
  budget: z.coerce.number().min(0).optional(),
});

export const updateCampaignSchema = createCampaignSchema
  .omit({ clientId: true })
  .partial()
  .extend({
    isActive: z.boolean().optional(),
    actualSpend: z.coerce.number().min(0).optional(),
  });

export const spendSchema = z.object({
  spendDate: z.string().min(1),
  amount: z.coerce.number().positive(),
  platform: z.string().trim().max(40).optional().or(z.literal("")),
  notes: z.string().trim().max(400).optional().or(z.literal("")),
});

export async function listCampaigns(clientId?: string) {
  return prisma.campaign.findMany({
    where: {
      isActive: true,
      ...(clientId ? { clientId } : {}),
    },
    orderBy: { name: "asc" },
    include: { client: { select: { id: true, name: true } }, industry: true },
  });
}

export async function listCampaignBoard(actor: AuthUser, filters: { q?: string; clientId?: string }) {
  const campaigns = await prisma.campaign.findMany({
    where: {
      ...campaignScope(actor),
      ...(filters.clientId ? { clientId: filters.clientId } : {}),
      ...(filters.q
        ? {
            OR: [
              { name: { contains: filters.q, mode: "insensitive" } },
              { client: { name: { contains: filters.q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      client: { select: { id: true, name: true } },
      industry: true,
      owner: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = await Promise.all(
    campaigns.map(async (campaign) => {
      const where = { campaignId: campaign.id, deletedAt: null };
      const base = await computeLeadMetrics(where);
      const lineSum = await prisma.marketingSpend.aggregate({
        where: { campaignId: campaign.id },
        _sum: { amount: true },
      });
      const spend =
        Number(lineSum._sum.amount ?? 0) || Number(campaign.actualSpend);
      const kpis = metricsFromCounts({ ...base, spend });
      return {
        id: campaign.id,
        name: campaign.name,
        platform: campaign.platform,
        campaignType: campaign.campaignType,
        startDate: campaign.startDate?.toISOString() ?? null,
        endDate: campaign.endDate?.toISOString() ?? null,
        budget: Number(campaign.budget),
        isActive: campaign.isActive,
        client: campaign.client,
        industry: campaign.industry,
        owner: campaign.owner,
        ...kpis,
      };
    }),
  );

  const totals = rows.reduce(
    (acc, row) => {
      acc.leads += row.leads;
      acc.valid += row.valid;
      acc.qualified += row.qualified;
      acc.hot += row.hot;
      acc.contacted += row.contacted;
      acc.connected += row.connected;
      acc.visits += row.visits;
      acc.won += row.won;
      acc.lost += row.lost;
      acc.revenue += row.revenue;
      acc.spend += row.spend;
      acc.expectedRevenue += row.expectedRevenue;
      acc.budget += row.budget;
      return acc;
    },
    {
      leads: 0,
      valid: 0,
      qualified: 0,
      hot: 0,
      contacted: 0,
      connected: 0,
      visits: 0,
      won: 0,
      lost: 0,
      revenue: 0,
      spend: 0,
      expectedRevenue: 0,
      budget: 0,
    },
  );

  const { budget, ...metricTotals } = totals;
  return {
    campaigns: rows,
    totals: { ...metricsFromCounts(metricTotals), budget },
    platforms: PLATFORMS,
    types: CAMPAIGN_TYPES,
  };
}

export async function getCampaign(actor: AuthUser, id: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id, ...campaignScope(actor) },
    include: {
      client: { select: { id: true, name: true } },
      industry: true,
      owner: { select: { id: true, name: true } },
      spend: { orderBy: { spendDate: "desc" }, take: 50 },
    },
  });
  if (!campaign) throw new HttpError(404, "Campaign not found", "NOT_FOUND");
  const where = { campaignId: campaign.id, deletedAt: null };
  const base = await computeLeadMetrics(where);
  const lineSum = await prisma.marketingSpend.aggregate({
    where: { campaignId: campaign.id },
    _sum: { amount: true },
  });
  const spend = Number(lineSum._sum.amount ?? 0) || Number(campaign.actualSpend);
  const utm = await prisma.lead.groupBy({
    by: ["utmSource", "utmMedium", "utmCampaign"],
    where,
    _count: { _all: true },
  });
  return {
    campaign: {
      ...campaign,
      budget: Number(campaign.budget),
      actualSpend: spend,
      spend: campaign.spend.map((s) => ({
        ...s,
        amount: Number(s.amount),
        spendDate: s.spendDate.toISOString(),
      })),
    },
    kpis: metricsFromCounts({ ...base, spend }),
    utm: utm
      .map((row) => ({
        source: row.utmSource ?? "—",
        medium: row.utmMedium ?? "—",
        campaign: row.utmCampaign ?? "—",
        leads: row._count._all,
      }))
      .sort((a, b) => b.leads - a.leads),
  };
}

export async function createCampaign(actor: AuthUser, input: z.infer<typeof createCampaignSchema>) {
  const data = createCampaignSchema.parse(input);
  const client = await prisma.client.findUnique({ where: { id: data.clientId } });
  if (!client) throw new HttpError(400, "Client not found", "INVALID_CLIENT");
  if (!client.industryId) {
    throw new HttpError(400, "Assign an industry to the client first", "CLIENT_NO_INDUSTRY");
  }

  const pipeline = await prisma.pipeline.findFirst({
    where: { industryId: client.industryId, isDefault: true },
  });

  const campaign = await prisma.campaign.create({
    data: {
      name: data.name,
      clientId: client.id,
      industryId: client.industryId,
      pipelineId: pipeline?.id,
      platform: data.platform || null,
      campaignType: data.campaignType || null,
      startDate: fromIstDateInput(data.startDate ?? "") ?? null,
      endDate: fromIstDateInput(data.endDate ?? "") ?? null,
      budget: data.budget ?? 0,
      ownerUserId: actor.id,
    },
    include: { client: { select: { id: true, name: true } }, industry: true },
  });

  await writeAudit({
    userId: actor.id,
    action: "campaign.created",
    entityType: "campaign",
    entityId: campaign.id,
    newValue: { name: campaign.name, clientId: client.id },
  });

  return campaign;
}

export async function updateCampaign(
  actor: AuthUser,
  id: string,
  input: z.infer<typeof updateCampaignSchema>,
) {
  const data = updateCampaignSchema.parse(input);
  const existing = await prisma.campaign.findFirst({ where: { id, ...campaignScope(actor) } });
  if (!existing) throw new HttpError(404, "Campaign not found", "NOT_FOUND");

  const campaign = await prisma.campaign.update({
    where: { id },
    data: {
      name: data.name,
      platform: data.platform === undefined ? undefined : data.platform || null,
      campaignType: data.campaignType === undefined ? undefined : data.campaignType || null,
      startDate: data.startDate === undefined ? undefined : fromIstDateInput(data.startDate) ?? null,
      endDate: data.endDate === undefined ? undefined : fromIstDateInput(data.endDate) ?? null,
      budget: data.budget,
      actualSpend: data.actualSpend,
      isActive: data.isActive,
    },
    include: { client: { select: { id: true, name: true } }, industry: true },
  });

  await writeAudit({
    userId: actor.id,
    action: "campaign.updated",
    entityType: "campaign",
    entityId: id,
    newValue: { name: campaign.name },
  });
  return campaign;
}

export async function addCampaignSpend(
  actor: AuthUser,
  campaignId: string,
  input: z.infer<typeof spendSchema>,
) {
  const data = spendSchema.parse(input);
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, ...campaignScope(actor) },
  });
  if (!campaign) throw new HttpError(404, "Campaign not found", "NOT_FOUND");
  const spendDate = fromIstDateInput(data.spendDate);
  if (!spendDate) throw new HttpError(400, "Invalid spend date", "VALIDATION");

  const line = await prisma.$transaction(async (tx) => {
    const created = await tx.marketingSpend.create({
      data: {
        campaignId,
        spendDate,
        amount: data.amount,
        platform: data.platform || campaign.platform,
        notes: data.notes || null,
      },
    });
    const sum = await tx.marketingSpend.aggregate({
      where: { campaignId },
      _sum: { amount: true },
    });
    await tx.campaign.update({
      where: { id: campaignId },
      data: { actualSpend: Number(sum._sum.amount ?? 0) },
    });
    return created;
  });

  await writeAudit({
    userId: actor.id,
    action: "campaign.spend_added",
    entityType: "campaign",
    entityId: campaignId,
    newValue: { amount: data.amount },
  });
  return line;
}

export async function importCampaignLeads(
  actor: AuthUser,
  campaignId: string,
  rows: Array<{ fullName?: string; firstName?: string; lastName?: string; mobile?: string; email?: string; city?: string }>,
  extras?: { assignedUserId?: string; nextFollowupAt?: string; nextAction?: string },
) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, ...campaignScope(actor) },
  });
  if (!campaign) throw new HttpError(404, "Campaign not found", "NOT_FOUND");

  let success = 0;
  let duplicates = 0;
  let invalid = 0;
  const errors: Array<{ row: number; message: string }> = [];

  const seen = new Set<string>();
  for (const [i, row] of rows.entries()) {
    let mobile = "";
    try {
      if (row.mobile) mobile = normalizeMobile(row.mobile);
    } catch {
      invalid += 1;
      errors.push({ row: i + 1, message: "Enter a valid mobile number" });
      continue;
    }
    const name = (row.fullName || [row.firstName, row.lastName].filter(Boolean).join(" ")).trim();
    if (!mobile || mobile.length < 10 || !name) {
      invalid += 1;
      errors.push({ row: i + 1, message: "Name and mobile are required" });
      continue;
    }
    if (seen.has(mobile)) {
      duplicates += 1;
      errors.push({ row: i + 1, message: "Duplicate mobile in this file" });
      continue;
    }
    seen.add(mobile);
    try {
      await createLeadWithDuplicateInfo(actor, {
        fullName: name,
        mobile,
        email: row.email ?? "",
        city: row.city ?? "",
        clientId: campaign.clientId,
        campaignId: campaign.id,
        assignedUserId: extras?.assignedUserId || actor.id,
        nextFollowupAt: extras?.nextFollowupAt,
        nextAction: extras?.nextAction,
      });
      success += 1;
    } catch (error) {
      if (error instanceof HttpError && error.code === "DUPLICATE") {
        duplicates += 1;
        errors.push({ row: i + 1, message: "Duplicate mobile for this client" });
      } else {
        invalid += 1;
        errors.push({
          row: i + 1,
          message: error instanceof Error ? error.message : "Rejected",
        });
      }
    }
  }

  return { total: rows.length, success, duplicates, invalid, rejected: invalid + duplicates, errors: errors.slice(0, 50) };
}

export async function importClientLeads(
  actor: AuthUser,
  clientId: string,
  input: {
    campaignId?: string;
    assignedUserId: string;
    rows: Array<{ fullName?: string; firstName?: string; lastName?: string; mobile?: string; email?: string; city?: string }>;
  },
) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new HttpError(404, "Client not found", "NOT_FOUND");
  let campaignId = input.campaignId?.trim() || "";
  if (campaignId) {
    const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, clientId } });
    if (!campaign) throw new HttpError(400, "Campaign does not belong to this client", "INVALID_CAMPAIGN");
  } else {
    const existing = await prisma.campaign.findFirst({
      where: { clientId, isActive: true },
      orderBy: { createdAt: "desc" },
    });
    if (existing) campaignId = existing.id;
    else {
      const created = await createCampaign(actor, {
        name: `CSV import · ${new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}`,
        clientId,
      });
      campaignId = created.id;
    }
  }
  const followAt = new Date().toISOString();
  const summary = await importCampaignLeads(
    actor,
    campaignId,
    input.rows,
    { assignedUserId: input.assignedUserId, nextFollowupAt: followAt, nextAction: "First outbound call" },
  );
  return { ...summary, campaignId };
}
