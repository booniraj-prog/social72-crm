import { z } from "zod";
import { ensureOpsTables } from "@/lib/ops-tables";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { HttpError } from "@/lib/session";
import { GENERIC_PIPELINE_STAGES, INDUSTRY_CATALOG, isHiddenIndustry } from "@/lib/industries";
import { optionalId } from "@/lib/ids";

const blankToNull = optionalId;

export const createClientSchema = z.object({
  name: z.string().trim().min(2).max(160),
  industryId: blankToNull,
  industryKey: z.string().trim().max(60).optional(),
  contactName: z.string().trim().max(120).optional().or(z.literal("")),
  contactEmail: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), "Invalid email"),
  contactPhone: z.string().trim().max(20).optional().or(z.literal("")),
  gstin: z.string().trim().max(20).optional().or(z.literal("")),
  pan: z.string().trim().max(12).optional().or(z.literal("")),
  address: z.string().trim().max(240).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  state: z.string().trim().max(80).optional().or(z.literal("")),
  category: z.string().trim().max(40).optional().or(z.literal("")),
  isActive: z.boolean().optional(),
  createStarterCampaign: z.boolean().optional(),
});

export const updateClientSchema = createClientSchema.partial();

export async function listClients(industryKey?: string, opts?: { includeInactive?: boolean }) {
  return prisma.client.findMany({
    where: {
      ...(industryKey ? { industry: { key: industryKey } } : {}),
      ...(opts?.includeInactive ? {} : { isActive: true }),
    },
    orderBy: { name: "asc" },
    include: { industry: true, _count: { select: { campaigns: true } } },
  });
}

export async function ensureIndustries() {
  for (const item of INDUSTRY_CATALOG) {
    const industry = await prisma.industry.upsert({
      where: { key: item.key },
      update: { name: item.name },
      create: { key: item.key, name: item.name },
    });
    const existing = await prisma.pipeline.findFirst({ where: { industryId: industry.id, isDefault: true } });
    if (existing) continue;
    const pipeline = await prisma.pipeline.create({
      data: { name: `${item.name} pipeline`, industryId: industry.id, isDefault: true },
    });
    const statuses = await prisma.leadStatus.findMany({
      where: { key: { in: [...GENERIC_PIPELINE_STAGES.map((s) => s.key)] } },
    });
    const byKey = Object.fromEntries(statuses.map((s) => [s.key, s.id]));
    for (const stage of GENERIC_PIPELINE_STAGES) {
      const statusId = byKey[stage.key];
      if (!statusId) continue;
      await prisma.pipelineStage.create({
        data: { pipelineId: pipeline.id, statusId, name: stage.name, sortOrder: stage.sortOrder },
      });
    }
  }
}

export async function listIndustries() {
  await ensureIndustries().catch(() => undefined);
  const rows = await prisma.industry.findMany({ orderBy: { name: "asc" } });
  return rows.filter((row) => !isHiddenIndustry(row.key));
}

export async function createClient(actorId: string, input: z.infer<typeof createClientSchema>) {
  const data = createClientSchema.parse(input);
  let industryId = data.industryId || null;
  if (!industryId && data.industryKey) {
    if (isHiddenIndustry(data.industryKey)) throw new HttpError(400, "Unknown industry", "INVALID_INDUSTRY");
    const industry = await prisma.industry.findUnique({ where: { key: data.industryKey } });
    if (!industry) throw new HttpError(400, "Unknown industry", "INVALID_INDUSTRY");
    industryId = industry.id;
  }
  if (industryId) {
    const industry = await prisma.industry.findUnique({ where: { id: industryId } });
    if (!industry || isHiddenIndustry(industry.key)) throw new HttpError(400, "Unknown industry", "INVALID_INDUSTRY");
  }

  const client = await prisma.client.create({
    data: {
      name: data.name,
      industryId,
      contactName: data.contactName || null,
      contactEmail: data.contactEmail || null,
      contactPhone: data.contactPhone || null,
      gstin: data.gstin || null,
      isActive: data.isActive ?? true,
    },
    include: { industry: true, _count: { select: { campaigns: true } } },
  });

  await ensureOpsTables();
  await prisma.$executeRaw`
    UPDATE clients
    SET pan = ${data.pan || null},
        address = ${data.address || null},
        city = ${data.city || null},
        state = ${data.state || null},
        category = ${data.category || null}
    WHERE id = ${client.id}
  `;

  if (data.createStarterCampaign && industryId) {
    const pipeline = await prisma.pipeline.findFirst({
      where: { industryId, isDefault: true },
    });
    await prisma.campaign.create({
      data: {
        name: `${client.name} · Launch`,
        clientId: client.id,
        industryId,
        pipelineId: pipeline?.id,
        campaignType: "lead_gen",
        ownerUserId: actorId,
      },
    });
  }

  await writeAudit({
    userId: actorId,
    action: "client.created",
    entityType: "client",
    entityId: client.id,
    newValue: { name: client.name, industryId },
  });

  return prisma.client.findUniqueOrThrow({
    where: { id: client.id },
    include: { industry: true, _count: { select: { campaigns: true } } },
  });
}

export async function updateClient(
  actorId: string,
  id: string,
  input: z.infer<typeof updateClientSchema>,
) {
  const data = updateClientSchema.parse(input);
  const existing = await prisma.client.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Client not found", "NOT_FOUND");

  if (data.industryId) {
    const industry = await prisma.industry.findUnique({ where: { id: data.industryId } });
    if (!industry || isHiddenIndustry(industry.key)) throw new HttpError(400, "Unknown industry", "INVALID_INDUSTRY");
  }

  const client = await prisma.client.update({
    where: { id },
    data: {
      name: data.name,
      industryId: data.industryId === undefined ? undefined : data.industryId || null,
      contactName: data.contactName === undefined ? undefined : data.contactName || null,
      contactEmail: data.contactEmail === undefined ? undefined : data.contactEmail || null,
      contactPhone: data.contactPhone === undefined ? undefined : data.contactPhone || null,
      isActive: data.isActive,
    },
    include: { industry: true, _count: { select: { campaigns: true } } },
  });

  await writeAudit({
    userId: actorId,
    action: "client.updated",
    entityType: "client",
    entityId: id,
    oldValue: { name: existing.name, isActive: existing.isActive },
    newValue: { name: client.name, isActive: client.isActive },
  });

  return client;
}
